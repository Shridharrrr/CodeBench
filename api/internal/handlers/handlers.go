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

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
)

type Server struct {
	router   *chi.Mux
	db       *database.DB
	queueMgr *queue.NATSManager
	broker   *events.Broker
}

func NewServer(db *database.DB, queueMgr *queue.NATSManager, broker *events.Broker) *Server {
	s := &Server{
		router:   chi.NewRouter(),
		db:       db,
		queueMgr: queueMgr,
		broker:   broker,
	}

	s.setupRoutes()
	return s
}

func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) setupRoutes() {
	r := s.router

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080", "http://127.0.0.1:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Last-Event-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health and probe endpoints
	r.Get("/healthz", s.handleHealthz)
	r.Get("/readyz", s.handleReadyz)
	r.Get("/metrics", s.handleMetrics)

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/problems", s.handleListProblems)
		r.Get("/problems/{slug}", s.handleGetProblem)
		r.Post("/problems/{slug}/submit", s.handleSubmit)
		r.Get("/submissions/{id}", s.handleGetSubmission)
		r.Get("/submissions/{id}/events", s.handleSubmissionEvents)
	})

	// Static SPA serving
	distPath := "./web/dist"
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
	output := `# HELP codebench_up Is the codebench system up
# TYPE codebench_up gauge
codebench_up 1
# HELP codebench_submissions_total Total count of submissions received
# TYPE codebench_submissions_total counter
codebench_submissions_total 1
`
	_, _ = w.Write([]byte(output))
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
		"sample_tests":  sampleTests,
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

	if req.Language == "" {
		req.Language = "cpp23-gcc"
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

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func contextWithTimeout(r *http.Request, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), d)
}
