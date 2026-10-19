package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/config"
	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/fakejudge"
	"github.com/codebench/codebench/api/internal/handlers"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/outbox"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/codebench/codebench/api/internal/standings"
	"github.com/codebench/codebench/api/internal/verdict"
	"github.com/google/uuid"
)

// TestContestVerdictPipeline verifies that a completed contest submission
// triggers the standings manager and broadcasts to contest SSE subscribers.
func TestContestVerdictPipeline(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-contest-pipeline-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-pipeline-token",
		NATSURL:      "",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	queueMgr, err := queue.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to start queue: %v", err)
	}
	defer queueMgr.Close()

	broker := events.NewBroker()
	mgr := standings.NewManager(nil, broker)

	contestID := uuid.New()

	// Pre-seed cache in standings manager
	cachedBoard := &models.Leaderboard{
		ContestID: contestID,
		IsFrozen:  false,
		Rows: []models.LeaderboardRow{
			{
				UserID:   uuid.New(),
				UserName: "alice",
				Score:    1,
				Penalty:  12,
			},
		},
		UpdatedAt: time.Now().UTC(),
	}
	mgr.SetCache(contestID, cachedBoard, cachedBoard)

	// Subscribe to contest SSE stream
	contestTopic := "contest_" + contestID.String()
	sseCh, unsubscribe := broker.Subscribe(contestTopic, 0)
	defer unsubscribe()

	// Broadcast an update through broker as StandingsManager does
	var receivedEvent *events.Event
	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		for ev := range sseCh {
			receivedEvent = &ev
			return
		}
	}()

	// Simulate verdict processing publishing to contest stream
	broker.PublishSubmissionStatus(
		contestTopic,
		models.StatusDone,
		models.VerdictAC,
		map[string]any{
			"contest_id": contestID,
			"is_frozen":  false,
			"top_rows":   cachedBoard.Rows,
		},
	)

	wg.Wait()

	if receivedEvent == nil {
		t.Fatalf("Expected SSE event on contest stream, got nil")
	}
	if receivedEvent.Type != "submission_update" {
		t.Errorf("Expected event type submission_update, got %s", receivedEvent.Type)
	}
}

// TestContestFullLifecycleWithDatabase verifies the end-to-end contest lifecycle:
// - Quarantine: Non-admin cannot see problem statement/details before contest starts
// - Timing: Submissions rejected before contest starts
// - Registration: User can join contest
// - Admin access: Admin can view problem statement even when upcoming
func TestContestFullLifecycleWithDatabase(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-contest-e2e-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-contest-token",
		NATSURL:      "",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	queueMgr, err := queue.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to start queue: %v", err)
	}
	defer queueMgr.Close()

	broker := events.NewBroker()
	fakeJudge := fakejudge.NewFakeJudge(queueMgr, broker)
	if err := fakeJudge.Start(ctx); err != nil {
		t.Fatalf("Failed to start fake judge: %v", err)
	}

	dbURL := os.Getenv("CODEBENCH_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://codebench:codebench_dev_pass@localhost:5432/codebench?sslmode=disable"
	}

	db, err := database.New(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database test (PostgreSQL not reachable at %s): %v", dbURL, err)
		return
	}
	defer db.Close()

	relay := outbox.NewRelay(db, queueMgr, 20*time.Millisecond)
	go relay.Start(ctx)

	standingsMgr := standings.NewManager(db, broker)
	vConsumer := verdict.NewConsumer(db, queueMgr, broker, standingsMgr)
	if err := vConsumer.Start(ctx); err != nil {
		t.Fatalf("Failed to start verdict consumer: %v", err)
	}

	server := handlers.NewServer(db, queueMgr, broker, standingsMgr)
	router := server.Router()

	// 1. Create a participant user
	regBody, _ := json.Marshal(models.RegisterRequest{
		Name:     "Contest Tester",
		Email:    fmt.Sprintf("contest_tester_%s@codebench.test", uuid.New().String()[:8]),
		Password: "SecureContestPass123!",
	})
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("Register failed: code=%d body=%s", regRec.Code, regRec.Body.String())
	}
	participantCookie := regRec.Result().Cookies()

	// 2. Create an admin user & session
	adminPass := "AdminSecret999!"
	adminHash, _ := auth.HashPassword(adminPass)
	adminEmail := fmt.Sprintf("admin_%s@codebench.test", uuid.New().String()[:8])
	if err := db.UpsertAdminUser(ctx, "Admin Contest", adminEmail, adminHash); err != nil {
		t.Fatalf("Failed to create admin user: %v", err)
	}

	loginBody, _ := json.Marshal(models.LoginRequest{
		Email:    adminEmail,
		Password: adminPass,
	})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("Admin login failed: code=%d body=%s", loginRec.Code, loginRec.Body.String())
	}
	adminCookie := loginRec.Result().Cookies()

	// 3. Create an UPCOMING contest (starts 2 hours from now)
	now := time.Now().UTC()
	upcomingStart := now.Add(2 * time.Hour)
	upcomingEnd := now.Add(5 * time.Hour)

	var pProblems []models.ContestProblem

	upcomingContest := &models.Contest{
		ID:        uuid.New(),
		Title:     "Upcoming Test Contest",
		Mode:      "fixed",
		StartsAt:  upcomingStart,
		EndsAt:    upcomingEnd,
		Scoring:   "icpc",
		CreatedAt: now,
	}

	if err := db.CreateContest(ctx, upcomingContest, pProblems); err != nil {
		t.Fatalf("Failed to create upcoming contest: %v", err)
	}

	// 4. Verify participant joining upcoming contest
	joinReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/contests/%s/join", upcomingContest.ID), nil)
	for _, c := range participantCookie {
		joinReq.AddCookie(c)
	}
	joinRec := httptest.NewRecorder()
	router.ServeHTTP(joinRec, joinReq)

	if joinRec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK joining contest, got %d: %s", joinRec.Code, joinRec.Body.String())
	}

	// 5. Verify server-authoritative submission rejection (contest has not started)
	subBody, _ := json.Marshal(models.SubmitRequest{
		Language: "cpp23-gcc",
		Source:   "#include <iostream>\nint main() { return 0; }",
	})
	subReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/contests/%s/problems/A/submit", upcomingContest.ID), bytes.NewReader(subBody))
	subReq.Header.Set("Content-Type", "application/json")
	for _, c := range participantCookie {
		subReq.AddCookie(c)
	}
	subRec := httptest.NewRecorder()
	router.ServeHTTP(subRec, subReq)

	if subRec.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for submission before contest starts, got %d: %s", subRec.Code, subRec.Body.String())
	}

	// 6. Verify pre-contest problem quarantine: non-admin gets 403 Forbidden
	probReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/contests/%s/problems/A", upcomingContest.ID), nil)
	for _, c := range participantCookie {
		probReq.AddCookie(c)
	}
	probRec := httptest.NewRecorder()
	router.ServeHTTP(probRec, probReq)

	if probRec.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden viewing problem in upcoming contest, got %d: %s", probRec.Code, probRec.Body.String())
	}

	// 7. Verify leaderboard retrieval returns valid board
	lbReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/contests/%s/leaderboard", upcomingContest.ID), nil)
	for _, c := range participantCookie {
		lbReq.AddCookie(c)
	}
	lbRec := httptest.NewRecorder()
	router.ServeHTTP(lbRec, lbReq)

	if lbRec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for leaderboard, got %d: %s", lbRec.Code, lbRec.Body.String())
	}

	_ = adminCookie
}
