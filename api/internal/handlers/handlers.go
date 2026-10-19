package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/canary"
	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/practice"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/codebench/codebench/api/internal/rejudge"
	"github.com/codebench/codebench/api/internal/runner"
	"github.com/codebench/codebench/api/internal/security"
	"github.com/codebench/codebench/api/internal/seed"
	"github.com/codebench/codebench/api/internal/standings"
	"github.com/codebench/codebench/pkg/problems"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
)

type Server struct {
	router            *chi.Mux
	db                *database.DB
	queueMgr          *queue.NATSManager
	broker            *events.Broker
	authHandler       *auth.AuthHandler
	standingsMgr      *standings.StandingsManager
	rejudgeSvc        *rejudge.Service
	canaryRunner      *canary.Canary
	authRateLimiter   *security.RateLimiter
	submitRateLimiter *security.RateLimiter
}

func NewServer(db *database.DB, queueMgr *queue.NATSManager, broker *events.Broker, standingsMgr *standings.StandingsManager) *Server {
	s := &Server{
		router:            chi.NewRouter(),
		db:                db,
		queueMgr:          queueMgr,
		broker:            broker,
		authHandler:       auth.NewAuthHandler(db),
		standingsMgr:      standingsMgr,
		rejudgeSvc:        rejudge.NewService(db, broker),
		canaryRunner:      canary.NewCanary(60*time.Second, 0.15),
		authRateLimiter:   security.NewRateLimiter(30, time.Minute),
		submitRateLimiter: security.NewRateLimiter(60, time.Minute),
	}

	s.setupRoutes()
	return s
}

func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) SetCanary(c *canary.Canary) {
	s.canaryRunner = c
}

func (s *Server) SetRejudgeService(r *rejudge.Service) {
	s.rejudgeSvc = r
}

func (s *Server) setupRoutes() {
	r := s.router

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// Global security headers and body limit
	r.Use(security.SecurityHeaders)
	r.Use(security.BodyLimit(10 * 1024 * 1024))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080", "http://127.0.0.1:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Last-Event-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Session authentication and CSRF protection
	r.Use(auth.AuthMiddleware(s.db))
	r.Use(auth.RequireCSRF)

	// Health and probe endpoints
	r.Get("/healthz", s.handleHealthz)
	r.Get("/readyz", s.handleReadyz)
	r.Get("/metrics", s.handleMetrics)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Auth routes (rate-limited)
		r.Route("/auth", func(r chi.Router) {
			r.With(s.authRateLimiter.Middleware()).Post("/register", s.authHandler.HandleRegister)
			r.With(s.authRateLimiter.Middleware()).Post("/login", s.authHandler.HandleLogin)
			r.Post("/logout", s.authHandler.HandleLogout)
			r.Get("/me", s.authHandler.HandleMe)
		})

		// Problems
		r.Get("/problems", s.handleListProblems)
		r.Get("/problems/{slug}", s.handleGetProblem)
		r.Post("/problems/validate", s.handleValidateProblem)
		r.Post("/problems/import", s.handleImportProblem)
		r.Post("/problems/{slug}/run", s.handleRunSample)
		r.With(security.BodyLimit(1*1024*1024), s.submitRateLimiter.Middleware()).Post("/problems/{slug}/submit", s.handleSubmit)

		// Submissions
		r.Get("/submissions", s.handleListSubmissions)
		r.Get("/submissions/{id}", s.handleGetSubmission)
		r.Get("/submissions/{id}/events", s.handleSubmissionEvents)

		// Contests
		r.Get("/contests", s.handleListContests)
		r.Post("/contests", s.handleCreateContest)
		r.Get("/contests/{id}", s.handleGetContest)
		r.Post("/contests/{id}/join", s.handleJoinContest)
		r.Get("/contests/{id}/problems/{label}", s.handleGetContestProblem)
		r.With(security.BodyLimit(1*1024*1024), s.submitRateLimiter.Middleware()).Post("/contests/{id}/problems/{label}/submit", s.handleContestSubmit)
		r.Get("/contests/{id}/leaderboard", s.handleGetLeaderboard)
		r.Get("/contests/{id}/events", s.handleContestEvents)

		// Practice Mode (Mode B)
		r.Post("/practice/generate", s.handleGeneratePractice)
		r.Get("/practice/history", s.handlePracticeHistory)

		// Admin Operations
		r.Route("/admin", func(r chi.Router) {
			r.Use(security.RequireRole("admin"))
			r.Post("/rejudge", s.handleAdminRejudge)
			r.Get("/rejudge/{id}", s.handleGetRejudgeStatus)
			r.Post("/problems/import", s.handleImportProblem)
			r.Post("/problems/validate", s.handleValidateProblem)
		})
	})

	// Static SPA serving
	distPath := "./web/dist"
	if _, err := os.Stat(distPath); err != nil {
		if _, err := os.Stat("/app/web/dist"); err == nil {
			distPath = "/app/web/dist"
		}
	}
	if _, err := os.Stat(distPath); err == nil {
		fileServer := http.FileServer(http.Dir(distPath))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(distPath, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(path); os.IsNotExist(err) || info.IsDir() {
				http.ServeFile(w, r, filepath.Join(distPath, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		})
	} else {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"ok","name":"Codebench API","version":"0.1.0"}`))
		})
	}
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (s *Server) handleReadyz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := contextWithTimeout(r, 2*time.Second)
	defer cancel()

	if err := s.db.Ping(ctx); err != nil {
		http.Error(w, `{"status":"not_ready","error":"database unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	if s.queueMgr != nil && !s.queueMgr.Ping() {
		http.Error(w, `{"status":"not_ready","error":"queue unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ready"}`))
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	w.WriteHeader(http.StatusOK)

	var sb strings.Builder
	sb.WriteString("# HELP codebench_up Is the codebench system up\n")
	sb.WriteString("# TYPE codebench_up gauge\n")
	sb.WriteString("codebench_up 1\n\n")

	// 1. Verdict counts
	sb.WriteString("# HELP codebench_submissions_total Total count of submissions by verdict\n")
	sb.WriteString("# TYPE codebench_submissions_total counter\n")
	if s.db != nil {
		verdictCounts, err := s.db.GetSubmissionVerdictCounts(r.Context())
		if err == nil && len(verdictCounts) > 0 {
			for verdict, count := range verdictCounts {
				sb.WriteString(fmt.Sprintf("codebench_submissions_total{verdict=%q} %d\n", verdict, count))
			}
		} else {
			sb.WriteString("codebench_submissions_total{verdict=\"ALL\"} 0\n")
		}
	} else {
		sb.WriteString("codebench_submissions_total{verdict=\"ALL\"} 0\n")
	}
	sb.WriteString("\n")

	// 2. Queue Depths by Lane
	sb.WriteString("# HELP codebench_queue_depth Count of pending outbox queue jobs by lane\n")
	sb.WriteString("# TYPE codebench_queue_depth gauge\n")
	if s.db != nil {
		depths, err := s.db.GetQueueDepths(r.Context())
		if err == nil && len(depths) > 0 {
			for subject, count := range depths {
				lane := "standard"
				if strings.Contains(subject, "priority") {
					lane = "priority"
				} else if strings.Contains(subject, "rejudge") {
					lane = "rejudge"
				}
				sb.WriteString(fmt.Sprintf("codebench_queue_depth{lane=%q,subject=%q} %d\n", lane, subject, count))
			}
		} else {
			sb.WriteString("codebench_queue_depth{lane=\"standard\",subject=\"jobs.submissions.standard\"} 0\n")
			sb.WriteString("codebench_queue_depth{lane=\"priority\",subject=\"jobs.submissions.priority\"} 0\n")
		}
	} else {
		sb.WriteString("codebench_queue_depth{lane=\"standard\",subject=\"jobs.submissions.standard\"} 0\n")
		sb.WriteString("codebench_queue_depth{lane=\"priority\",subject=\"jobs.submissions.priority\"} 0\n")
	}
	sb.WriteString("\n")

	// 3. Active SSE Connections
	activeSSE := 0
	if s.broker != nil {
		activeSSE = s.broker.ActiveConnections()
	}
	sb.WriteString("# HELP codebench_sse_connections_active Number of active Server-Sent Events subscribers\n")
	sb.WriteString("# TYPE codebench_sse_connections_active gauge\n")
	sb.WriteString(fmt.Sprintf("codebench_sse_connections_active %d\n\n", activeSSE))

	// 4. Timing Canary Metrics
	if s.canaryRunner != nil {
		dur := s.canaryRunner.LastDuration().Seconds()
		drift := s.canaryRunner.DriftRatio()
		healthyVal := 0
		if s.canaryRunner.IsHealthy() {
			healthyVal = 1
		}

		sb.WriteString("# HELP codebench_canary_duration_seconds Last execution duration of calibration canary\n")
		sb.WriteString("# TYPE codebench_canary_duration_seconds gauge\n")
		sb.WriteString(fmt.Sprintf("codebench_canary_duration_seconds %.6f\n\n", dur))

		sb.WriteString("# HELP codebench_canary_timing_drift_ratio Relative timing drift compared to baseline\n")
		sb.WriteString("# TYPE codebench_canary_timing_drift_ratio gauge\n")
		sb.WriteString(fmt.Sprintf("codebench_canary_timing_drift_ratio %.4f\n\n", drift))

		sb.WriteString("# HELP codebench_canary_healthy Whether judge host CPU timing is within tolerance\n")
		sb.WriteString("# TYPE codebench_canary_healthy gauge\n")
		sb.WriteString(fmt.Sprintf("codebench_canary_healthy %d\n", healthyVal))
	}

	_, _ = w.Write([]byte(sb.String()))
}

func (s *Server) handleAdminRejudge(w http.ResponseWriter, r *http.Request) {
	var req models.RejudgeBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.ScopeType == "" || req.ScopeID == "" {
		http.Error(w, `{"error":"scope_type and scope_id are required"}`, http.StatusBadRequest)
		return
	}

	user := auth.UserFromContext(r.Context())
	var userID *uuid.UUID
	if user != nil {
		userID = &user.ID
	}

	resp, err := s.rejudgeSvc.TriggerRejudge(r.Context(), req, userID)
	if err != nil {
		slog.Error("Failed to trigger rejudge batch", "error", err)
		http.Error(w, fmt.Sprintf(`{"error":"failed to trigger rejudge: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusAccepted, resp)
}

func (s *Server) handleGetRejudgeStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	batchID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid batch id"}`, http.StatusBadRequest)
		return
	}

	status, err := s.rejudgeSvc.GetStatus(r.Context(), batchID)
	if err != nil {
		http.Error(w, `{"error":"rejudge batch not found"}`, http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleListProblems(w http.ResponseWriter, r *http.Request) {
	problems, err := s.db.ListProblems(r.Context())
	if err != nil {
		slog.Error("Failed to list problems", "error", err)
		http.Error(w, `{"error":"failed to list problems"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, problems)
}

func (s *Server) handleGetProblem(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	prob, ver, testCases, err := s.db.GetProblemBySlug(r.Context(), slug)
	if err != nil {
		http.Error(w, `{"error":"problem not found"}`, http.StatusNotFound)
		return
	}

	// Filter test cases: ONLY return sample tests to the client! Hidden tests are never exposed.
	var sampleTests []map[string]any
	for _, tc := range testCases {
		if tc.IsSample {
			sampleTests = append(sampleTests, map[string]any{
				"ordinal":     tc.Ordinal,
				"group_name":  tc.GroupName,
				"input_data":  tc.InputData,
				"output_data": tc.OutputData,
			})
		}
	}

	resp := map[string]any{
		"slug":          prob.Slug,
		"title":         ver.Title,
		"statement_md":  ver.StatementMD,
		"difficulty":    ver.Difficulty,
		"tags":          ver.Tags,
		"time_limit_ms": ver.TimeLimitMS,
		"memory_mb":     ver.MemoryMB,
		"checker_type":  ver.CheckerType,
		"version":       ver.Version,
		"package_hash":  ver.PackageHash,
		"published_at":  ver.PublishedAt,
		"sample_tests":  sampleTests,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleRunSample(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var req models.RunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Source) == "" {
		http.Error(w, `{"error":"source code cannot be empty"}`, http.StatusBadRequest)
		return
	}

	if len(req.Source) > 64*1024 {
		http.Error(w, `{"error":"source code exceeds maximum size of 64KB"}`, http.StatusBadRequest)
		return
	}

	if req.Language == "" {
		req.Language = "cpp23-gcc"
	}

	validLangs := map[string]bool{"cpp23-gcc": true, "cpp23-clang": true, "c23-gcc": true, "c23-clang": true}
	if !validLangs[req.Language] {
		http.Error(w, `{"error":"unsupported language"}`, http.StatusBadRequest)
		return
	}

	_, ver, testCases, err := s.db.GetProblemBySlug(r.Context(), slug)
	if err != nil {
		http.Error(w, `{"error":"problem not found"}`, http.StatusNotFound)
		return
	}

	// Strictly sample test cases only - HIDDEN TESTS ARE NEVER ACCESSED
	var sampleCases []models.TestCase
	for _, tc := range testCases {
		if tc.IsSample {
			sampleCases = append(sampleCases, tc)
		}
	}

	resp, err := runner.RunSampleCases(r.Context(), req.Language, req.Source, sampleCases, req.CustomInput, ver.TimeLimitMS)
	if err != nil {
		slog.Error("Sample run failed", "error", err)
		http.Error(w, fmt.Sprintf(`{"error":"execution error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleSubmit(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var req models.SubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Source) == "" {
		http.Error(w, `{"error":"source code cannot be empty"}`, http.StatusBadRequest)
		return
	}

	if len(req.Source) > 64*1024 {
		http.Error(w, `{"error":"source code exceeds maximum size of 64KB"}`, http.StatusBadRequest)
		return
	}

	if req.Language == "" {
		req.Language = "cpp23-gcc"
	}

	validLangs := map[string]bool{"cpp23-gcc": true, "cpp23-clang": true, "c23-gcc": true, "c23-clang": true}
	if !validLangs[req.Language] {
		http.Error(w, `{"error":"unsupported language"}`, http.StatusBadRequest)
		return
	}

	// 1. Fetch current problem version & tests
	_, ver, testCases, err := s.db.GetProblemBySlug(r.Context(), slug)
	if err != nil {
		http.Error(w, `{"error":"problem not found"}`, http.StatusNotFound)
		return
	}

	// Compute source hash
	h := sha256.Sum256([]byte(req.Source))
	sourceHash := hex.EncodeToString(h[:])

	submissionID := uuid.New()
	sub := &models.Submission{
		ID:               submissionID,
		ProblemVersionID: ver.ID,
		Language:         req.Language,
		SourceHash:       sourceHash,
		Source:           req.Source,
		Status:           models.StatusQueued,
		Verdict:          models.VerdictPending,
		CreatedAt:        time.Now().UTC(),
	}

	// Link user if authenticated
	if u := auth.UserFromContext(r.Context()); u != nil {
		sub.UserID = &u.ID
	}

	// Build job payload for the judge work-queue
	jobPayload := &models.JudgeJobPayload{
		SubmissionID:  submissionID.String(),
		AttemptID:     uuid.New().String(),
		Language:      req.Language,
		SourceCode:    req.Source,
		TimeLimitMS:   int64(ver.TimeLimitMS),
		MemoryLimitKB: int64(ver.MemoryMB * 1024),
		CheckerType:   ver.CheckerType,
		TestCases:     testCases,
	}

	// 2. Insert submission + outbox in single atomic transaction
	if err := s.db.CreateSubmissionTx(r.Context(), sub, jobPayload); err != nil {
		slog.Error("Failed to create submission transaction", "error", err)
		http.Error(w, `{"error":"failed to queue submission"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast initial QUEUED event
	s.broker.PublishSubmissionStatus(submissionID.String(), models.StatusQueued, models.VerdictPending, nil)

	slog.Info("Submission accepted and queued", "submission_id", submissionID, "slug", slug)
	writeJSON(w, http.StatusAccepted, models.SubmitResponse{
		SubmissionID: submissionID.String(),
		Status:       models.StatusQueued,
	})
}

func (s *Server) handleListSubmissions(w http.ResponseWriter, r *http.Request) {
	slug := r.URL.Query().Get("slug")
	verdict := r.URL.Query().Get("verdict")
	userIDStr := r.URL.Query().Get("user_id")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	var userID *uuid.UUID
	if userIDStr != "" {
		if uid, err := uuid.Parse(userIDStr); err == nil {
			userID = &uid
		}
	} else if r.URL.Query().Get("me") == "true" {
		if u := auth.UserFromContext(r.Context()); u != nil {
			userID = &u.ID
		}
	}

	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	offset := 0
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	submissions, err := s.db.ListSubmissions(r.Context(), slug, userID, verdict, limit, offset)
	if err != nil {
		slog.Error("Failed to list submissions", "error", err)
		http.Error(w, `{"error":"failed to list submissions"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, submissions)
}

func (s *Server) handleGetSubmission(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid submission id"}`, http.StatusBadRequest)
		return
	}

	sub, err := s.db.GetSubmission(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"submission not found"}`, http.StatusNotFound)
		return
	}

	// Defense-in-depth: sanitize test diagnostics for non-admin callers to quarantine hidden test data
	user := auth.UserFromContext(r.Context())
	isAdmin := user != nil && user.Role == "admin"
	if !isAdmin && sub.Results != nil {
		for i := range sub.Results {
			if sub.Results[i].Verdict == models.VerdictWA {
				sub.Results[i].Diagnostic = "Wrong Answer"
			}
			if len(sub.Results[i].Diagnostic) > 512 {
				sub.Results[i].Diagnostic = sub.Results[i].Diagnostic[:512] + "... [truncated]"
			}
		}
	}
	if sub.CompileOutput != nil && len(*sub.CompileOutput) > 4096 {
		truncated := (*sub.CompileOutput)[:4096] + "\n... [truncated]"
		sub.CompileOutput = &truncated
	}

	writeJSON(w, http.StatusOK, sub)
}

func (s *Server) handleSubmissionEvents(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing submission id", http.StatusBadRequest)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	lastEventIDStr := r.Header.Get("Last-Event-ID")
	var lastEventID int64
	if lastEventIDStr != "" {
		lastEventID, _ = strconv.ParseInt(lastEventIDStr, 10, 64)
	}

	sendFunc := func(eventID int64, eventType string, data []byte) error {
		if eventID > 0 {
			if _, err := fmt.Fprintf(w, "id: %d\n", eventID); err != nil {
				return err
			}
		}
		if eventType != "" {
			if _, err := fmt.Fprintf(w, "event: %s\n", eventType); err != nil {
				return err
			}
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", string(data)); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	_ = s.broker.StreamSSE(r.Context(), id, lastEventID, sendFunc)
}

func (s *Server) handleValidateProblem(w http.ResponseWriter, r *http.Request) {
	if u := auth.UserFromContext(r.Context()); u != nil && u.Role != "admin" {
		http.Error(w, `{"error":"forbidden: admin privileges required"}`, http.StatusForbidden)
		return
	}

	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Path) == "" {
		body.Path = "./problems"
	}

	pkg, err := problems.LoadPackage(body.Path)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to load problem package: %v"}`, err), http.StatusBadRequest)
		return
	}

	report, err := problems.ValidatePackage(r.Context(), pkg)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"validation execution error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, report)
}

func (s *Server) handleImportProblem(w http.ResponseWriter, r *http.Request) {
	if u := auth.UserFromContext(r.Context()); u != nil && u.Role != "admin" {
		http.Error(w, `{"error":"forbidden: admin privileges required"}`, http.StatusForbidden)
		return
	}
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Path) == "" {
		body.Path = "./problems"
	}

	fi, err := os.Stat(body.Path)
	if err != nil {
		http.Error(w, `{"error":"path not found"}`, http.StatusBadRequest)
		return
	}

	if _, err := os.Stat(filepath.Join(body.Path, "problem.yaml")); err == nil {
		res, err := seed.ImportPackage(r.Context(), s.db, body.Path)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"import failed: %v"}`, err), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, res)
		return
	}

	if fi.IsDir() {
		results, err := seed.ImportAll(r.Context(), s.db, body.Path)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"batch import failed: %v"}`, err), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, results)
		return
	}

	http.Error(w, `{"error":"invalid problem path"}`, http.StatusBadRequest)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func contextWithTimeout(r *http.Request, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), d)
}

// Contest Handlers & Server-Authoritative Timing

func getContestState(c *models.Contest, now time.Time) (models.ContestState, int64) {
	if now.Before(c.StartsAt) {
		return models.ContestUpcoming, c.StartsAt.Sub(now).Milliseconds()
	}
	if !now.Before(c.EndsAt) {
		return models.ContestEnded, 0
	}
	if c.FreezeAt != nil && !now.Before(*c.FreezeAt) {
		return models.ContestFrozen, c.EndsAt.Sub(now).Milliseconds()
	}
	return models.ContestRunning, c.EndsAt.Sub(now).Milliseconds()
}

func (s *Server) handleListContests(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("mode")
	list, err := s.db.ListContests(r.Context(), mode)
	if err != nil {
		slog.Error("Failed to list contests", "error", err)
		http.Error(w, `{"error":"failed to list contests"}`, http.StatusInternalServerError)
		return
	}

	now := time.Now().UTC()
	resp := make([]map[string]any, 0, len(list))
	for _, c := range list {
		state, timeRemaining := getContestState(&c, now)
		probs, _ := s.db.GetContestProblems(r.Context(), c.ID)
		parts, _ := s.db.GetContestParticipants(r.Context(), c.ID)

		resp = append(resp, map[string]any{
			"id":                c.ID,
			"title":             c.Title,
			"mode":              c.Mode,
			"starts_at":         c.StartsAt,
			"ends_at":           c.EndsAt,
			"freeze_at":         c.FreezeAt,
			"scoring":           c.Scoring,
			"server_time":       now,
			"state":             state,
			"time_remaining_ms": timeRemaining,
			"problem_count":     len(probs),
			"participant_count": len(parts),
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleGetContest(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid contest id"}`, http.StatusBadRequest)
		return
	}

	c, err := s.db.GetContest(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"contest not found"}`, http.StatusNotFound)
		return
	}

	now := time.Now().UTC()
	state, timeRemaining := getContestState(c, now)

	user := auth.UserFromContext(r.Context())
	isAdmin := user != nil && user.Role == "admin"
	isRegistered := false
	if user != nil {
		isRegistered, _ = s.db.IsParticipant(r.Context(), id, user.ID)
	}

	probs, err := s.db.GetContestProblems(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch contest problems"}`, http.StatusInternalServerError)
		return
	}

	// Pre-contest quarantine: hide problem details if contest is upcoming and caller is not admin
	var problemSummaries []map[string]any
	for _, p := range probs {
		if state == models.ContestUpcoming && !isAdmin {
			problemSummaries = append(problemSummaries, map[string]any{
				"label":  p.Label,
				"points": p.Points,
			})
		} else {
			problemSummaries = append(problemSummaries, map[string]any{
				"label":      p.Label,
				"points":     p.Points,
				"title":      p.Title,
				"slug":       p.Slug,
				"difficulty": p.Difficulty,
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":                c.ID,
		"title":             c.Title,
		"mode":              c.Mode,
		"starts_at":         c.StartsAt,
		"ends_at":           c.EndsAt,
		"freeze_at":         c.FreezeAt,
		"scoring":           c.Scoring,
		"server_time":       now,
		"state":             state,
		"time_remaining_ms": timeRemaining,
		"is_registered":     isRegistered,
		"problems":          problemSummaries,
	})
}

func (s *Server) handleJoinContest(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid contest id"}`, http.StatusBadRequest)
		return
	}

	user := auth.UserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"authentication required to join contest"}`, http.StatusUnauthorized)
		return
	}

	if err := s.db.JoinContest(r.Context(), id, user.ID); err != nil {
		slog.Error("Failed to join contest", "error", err)
		http.Error(w, `{"error":"failed to join contest"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "joined",
		"contest_id": id,
		"user_id":    user.ID,
	})
}

func (s *Server) handleGetContestProblem(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	contestID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid contest id"}`, http.StatusBadRequest)
		return
	}

	label := chi.URLParam(r, "label")
	c, err := s.db.GetContest(r.Context(), contestID)
	if err != nil {
		http.Error(w, `{"error":"contest not found"}`, http.StatusNotFound)
		return
	}

	now := time.Now().UTC()
	user := auth.UserFromContext(r.Context())
	isAdmin := user != nil && user.Role == "admin"

	// Pre-contest quarantine: block problem viewing before start
	if now.Before(c.StartsAt) && !isAdmin {
		http.Error(w, `{"error":"contest has not started yet"}`, http.StatusForbidden)
		return
	}

	cp, pv, testCases, err := s.db.GetContestProblemByLabel(r.Context(), contestID, label)
	if err != nil {
		http.Error(w, `{"error":"contest problem not found"}`, http.StatusNotFound)
		return
	}

	// Filter sample tests strictly (hidden tests quarantined)
	var sampleTests []map[string]any
	for _, tc := range testCases {
		if tc.IsSample {
			sampleTests = append(sampleTests, map[string]any{
				"ordinal":     tc.Ordinal,
				"group_name":  tc.GroupName,
				"input_data":  tc.InputData,
				"output_data": tc.OutputData,
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"label":         cp.Label,
		"points":        cp.Points,
		"title":         cp.Title,
		"slug":          cp.Slug,
		"difficulty":    cp.Difficulty,
		"statement_md":  pv.StatementMD,
		"time_limit_ms":     pv.TimeLimitMS,
		"memory_mb":         pv.MemoryMB,
		"checker_type":      pv.CheckerType,
		"complexity_policy": pv.ComplexityPolicy,
		"sample_tests":      sampleTests,
	})
}

func (s *Server) handleContestSubmit(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	contestID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid contest id"}`, http.StatusBadRequest)
		return
	}

	label := chi.URLParam(r, "label")

	c, err := s.db.GetContest(r.Context(), contestID)
	if err != nil {
		http.Error(w, `{"error":"contest not found"}`, http.StatusNotFound)
		return
	}

	// Server-authoritative timer validation
	now := time.Now().UTC()
	if now.Before(c.StartsAt) {
		http.Error(w, `{"error":"contest has not started yet"}`, http.StatusBadRequest)
		return
	}
	if !now.Before(c.EndsAt) {
		http.Error(w, `{"error":"contest has already ended"}`, http.StatusBadRequest)
		return
	}

	user := auth.UserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"authentication required to submit to contest"}`, http.StatusUnauthorized)
		return
	}

	// Auto-register participant if needed
	_ = s.db.JoinContest(r.Context(), contestID, user.ID)

	var req models.SubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Source) == "" {
		http.Error(w, `{"error":"source code cannot be empty"}`, http.StatusBadRequest)
		return
	}
	if len(req.Source) > 64*1024 {
		http.Error(w, `{"error":"source code exceeds maximum size of 64KB"}`, http.StatusBadRequest)
		return
	}
	if req.Language == "" {
		req.Language = "cpp23-gcc"
	}

	validLangs := map[string]bool{"cpp23-gcc": true, "cpp23-clang": true, "c23-gcc": true, "c23-clang": true}
	if !validLangs[req.Language] {
		http.Error(w, `{"error":"unsupported language"}`, http.StatusBadRequest)
		return
	}

	cp, pv, testCases, err := s.db.GetContestProblemByLabel(r.Context(), contestID, label)
	if err != nil {
		http.Error(w, `{"error":"contest problem not found"}`, http.StatusNotFound)
		return
	}

	h := sha256.Sum256([]byte(req.Source))
	sourceHash := hex.EncodeToString(h[:])

	submissionID := uuid.New()
	sub := &models.Submission{
		ID:               submissionID,
		UserID:           &user.ID,
		ProblemVersionID: cp.ProblemVersionID,
		ContestID:        &contestID,
		Language:         req.Language,
		SourceHash:       sourceHash,
		Source:           req.Source,
		Status:           models.StatusQueued,
		Verdict:          models.VerdictPending,
		CreatedAt:        now,
	}

	jobPayload := &models.JudgeJobPayload{
		SubmissionID:  submissionID.String(),
		AttemptID:     uuid.New().String(),
		Language:      req.Language,
		SourceCode:    req.Source,
		TimeLimitMS:   int64(pv.TimeLimitMS),
		MemoryLimitKB: int64(pv.MemoryMB * 1024),
		CheckerType:   pv.CheckerType,
		TestCases:     testCases,
	}

	if err := s.db.CreateSubmissionTx(r.Context(), sub, jobPayload); err != nil {
		slog.Error("Failed to create contest submission transaction", "error", err)
		http.Error(w, `{"error":"failed to queue contest submission"}`, http.StatusInternalServerError)
		return
	}

	s.broker.PublishSubmissionStatus(submissionID.String(), models.StatusQueued, models.VerdictPending, nil)

	writeJSON(w, http.StatusAccepted, models.SubmitResponse{
		SubmissionID: submissionID.String(),
		Status:       models.StatusQueued,
	})
}

func (s *Server) handleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	contestID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid contest id"}`, http.StatusBadRequest)
		return
	}

	user := auth.UserFromContext(r.Context())
	isAdmin := user != nil && user.Role == "admin"

	board, err := s.standingsMgr.GetLeaderboard(r.Context(), contestID, isAdmin)
	if err != nil {
		slog.Error("Failed to get leaderboard", "contest_id", contestID, "error", err)
		http.Error(w, `{"error":"failed to calculate leaderboard"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, board)
}

func (s *Server) handleContestEvents(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "missing contest id", http.StatusBadRequest)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	lastEventIDStr := r.Header.Get("Last-Event-ID")
	var lastEventID int64
	if lastEventIDStr != "" {
		lastEventID, _ = strconv.ParseInt(lastEventIDStr, 10, 64)
	}

	sendFunc := func(eventID int64, eventType string, data []byte) error {
		if eventID > 0 {
			_, _ = fmt.Fprintf(w, "id: %d\n", eventID)
		}
		if eventType != "" {
			_, _ = fmt.Fprintf(w, "event: %s\n", eventType)
		}
		_, _ = fmt.Fprintf(w, "data: %s\n\n", string(data))
		flusher.Flush()
		return nil
	}

	_ = s.broker.StreamSSE(r.Context(), "contest_"+id, lastEventID, sendFunc)
}

func (s *Server) handleCreateContest(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil || user.Role != "admin" {
		http.Error(w, `{"error":"admin role required to create contest"}`, http.StatusForbidden)
		return
	}

	var req struct {
		Title    string                  `json:"title"`
		Mode     string                  `json:"mode"`
		StartsAt time.Time               `json:"starts_at"`
		EndsAt   time.Time               `json:"ends_at"`
		FreezeAt *time.Time              `json:"freeze_at,omitempty"`
		Scoring  string                  `json:"scoring"`
		Problems []models.ContestProblem `json:"problems"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
		return
	}
	if req.Mode == "" {
		req.Mode = "fixed"
	}
	if req.Scoring == "" {
		req.Scoring = "icpc"
	}

	contest := &models.Contest{
		ID:        uuid.New(),
		Title:     req.Title,
		Mode:      req.Mode,
		StartsAt:  req.StartsAt,
		EndsAt:    req.EndsAt,
		FreezeAt:  req.FreezeAt,
		Scoring:   req.Scoring,
		OwnerID:   &user.ID,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.db.CreateContest(r.Context(), contest, req.Problems); err != nil {
		slog.Error("Failed to create contest", "error", err)
		http.Error(w, `{"error":"failed to create contest"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, contest)
}

func (s *Server) handleGeneratePractice(w http.ResponseWriter, r *http.Request) {
	var req models.PracticeGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req = models.PracticeGenerateRequest{Count: 3, Difficulty: "ANY"}
	}

	user := auth.UserFromContext(r.Context())
	var userID *uuid.UUID
	if user != nil {
		userID = &user.ID
	}

	svc := practice.NewService(s.db)
	resp, err := svc.GeneratePracticeSet(r.Context(), userID, req)
	if err != nil {
		slog.Error("Failed to generate practice set", "error", err)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (s *Server) handlePracticeHistory(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		http.Error(w, `{"error":"authentication required to view practice history"}`, http.StatusUnauthorized)
		return
	}

	svc := practice.NewService(s.db)
	history, err := svc.ListUserPracticeHistory(r.Context(), user.ID)
	if err != nil {
		slog.Error("Failed to list practice history", "error", err)
		http.Error(w, `{"error":"failed to fetch practice history"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, history)
}

