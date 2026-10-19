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
	"strings"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/canary"
	"github.com/codebench/codebench/api/internal/config"
	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/fakejudge"
	"github.com/codebench/codebench/api/internal/handlers"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/outbox"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/codebench/codebench/api/internal/seed"
	"github.com/codebench/codebench/api/internal/standings"
	"github.com/codebench/codebench/api/internal/sweeper"
	"github.com/codebench/codebench/api/internal/verdict"
	"github.com/google/uuid"
)

// TestPhase7ObservabilityMetrics verifies that Prometheus metrics export timing canary,
// queue depth, and health telemetry.
func TestPhase7ObservabilityMetrics(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-metrics-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "metrics-token",
		NATSURL:      "",
	}

	queueMgr, err := queue.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to start NATS: %v", err)
	}
	defer queueMgr.Close()

	broker := events.NewBroker()
	server := handlers.NewServer(nil, queueMgr, broker, nil)

	// Attach canary runner
	canaryRunner := canary.NewCanary(100*time.Millisecond, 0.20)
	canaryRunner.RunOnce()
	server.SetCanary(canaryRunner)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	server.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected HTTP 200 from /metrics, got %d", rec.Code)
	}

	metricsOutput := rec.Body.String()
	requiredMetrics := []string{
		"codebench_up 1",
		"codebench_submissions_total",
		"codebench_queue_depth",
		"codebench_sse_connections_active 0",
		"codebench_canary_duration_seconds",
		"codebench_canary_timing_drift_ratio",
		"codebench_canary_healthy",
	}

	for _, m := range requiredMetrics {
		if !strings.Contains(metricsOutput, m) {
			t.Errorf("Metrics output missing expected metric %q.\nOutput:\n%s", m, metricsOutput)
		}
	}
}

// TestPhase7RejudgeAndSweeperPipeline tests batch rejudges, priority queue lanes,
// and stale job recovery against live database (when reachable).
func TestPhase7RejudgeAndSweeperPipeline(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-phase7-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "phase7-token",
		NATSURL:      "",
	}

	queueMgr, err := queue.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to start embedded NATS: %v", err)
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

	// 1. Seed problem packages
	_ = seed.SeedDatabase(ctx, db, "../../../problems", "AdminDev123!")

	relay := outbox.NewRelay(db, queueMgr, 20*time.Millisecond)
	go relay.Start(ctx)

	standingsMgr := standings.NewManager(db, broker)
	vConsumer := verdict.NewConsumer(db, queueMgr, broker, standingsMgr)
	if err := vConsumer.Start(ctx); err != nil {
		t.Fatalf("Failed to start verdict consumer: %v", err)
	}

	server := handlers.NewServer(db, queueMgr, broker, standingsMgr)
	router := server.Router()

	// 2. Register participant
	regBody, _ := json.Marshal(models.RegisterRequest{
		Name:     "Phase 7 Runner",
		Email:    fmt.Sprintf("phase7_%s@codebench.test", uuid.New().String()[:8]),
		Password: "Phase7Password123!",
	})
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("Failed to register user: %d %s", regRec.Code, regRec.Body.String())
	}
	userCookies := regRec.Result().Cookies()

	// 3. Submit solution to two-sum
	twoSumCpp := `#include <iostream>
int main() {
    long long a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << "\n";
    }
    return 0;
}
`
	subBody, _ := json.Marshal(models.SubmitRequest{
		Language: "cpp23-gcc",
		Source:   twoSumCpp,
	})
	subReq := httptest.NewRequest(http.MethodPost, "/api/problems/two-sum/submit", bytes.NewReader(subBody))
	subReq.Header.Set("Content-Type", "application/json")
	for _, c := range userCookies {
		subReq.AddCookie(c)
		if c.Name == "csrf_token" {
			subReq.Header.Set("X-CSRF-Token", c.Value)
		}
	}
	subRec := httptest.NewRecorder()
	router.ServeHTTP(subRec, subReq)

	if subRec.Code != http.StatusOK {
		t.Fatalf("Failed to submit solution: %d %s", subRec.Code, subRec.Body.String())
	}

	var subResp models.SubmitResponse
	_ = json.Unmarshal(subRec.Body.Bytes(), &subResp)
	subUUID, err := uuid.Parse(subResp.SubmissionID)
	if err != nil {
		t.Fatalf("Invalid submission ID received: %v", err)
	}

	// Wait for terminal AC verdict
	var finalSub *models.Submission
	for i := 0; i < 40; i++ {
		time.Sleep(100 * time.Millisecond)
		s, err := db.GetSubmission(ctx, subUUID)
		if err == nil && s.Status == models.StatusDone {
			finalSub = s
			break
		}
	}
	if finalSub == nil || finalSub.Verdict != models.VerdictAC {
		t.Fatalf("Expected AC verdict on initial submission, got: %+v", finalSub)
	}

	// 4. Trigger Batch Rejudge for this submission via POST /api/admin/rejudge
	rejudgeBody, _ := json.Marshal(models.RejudgeBatchRequest{
		ScopeType: models.RejudgeScopeSubmission,
		ScopeID:   subUUID.String(),
	})
	rejudgeReq := httptest.NewRequest(http.MethodPost, "/api/admin/rejudge", bytes.NewReader(rejudgeBody))
	rejudgeReq.Header.Set("Content-Type", "application/json")
	for _, c := range userCookies {
		rejudgeReq.AddCookie(c)
		if c.Name == "csrf_token" {
			rejudgeReq.Header.Set("X-CSRF-Token", c.Value)
		}
	}
	rejudgeRec := httptest.NewRecorder()
	router.ServeHTTP(rejudgeRec, rejudgeReq)

	if rejudgeRec.Code != http.StatusAccepted {
		t.Fatalf("Expected HTTP 202 Accepted from /api/admin/rejudge, got %d %s", rejudgeRec.Code, rejudgeRec.Body.String())
	}

	var rejudgeResp models.RejudgeBatchResponse
	if err := json.Unmarshal(rejudgeRec.Body.Bytes(), &rejudgeResp); err != nil {
		t.Fatalf("Failed to unmarshal rejudge response: %v", err)
	}
	if rejudgeResp.QueuedCount != 1 || rejudgeResp.Status != "processing" {
		t.Fatalf("Unexpected rejudge response: %+v", rejudgeResp)
	}

	// 5. Query Batch Status via GET /api/admin/rejudge/{id}
	statusReq := httptest.NewRequest(http.MethodGet, "/api/admin/rejudge/"+rejudgeResp.BatchID, nil)
	for _, c := range userCookies {
		statusReq.AddCookie(c)
	}
	statusRec := httptest.NewRecorder()
	router.ServeHTTP(statusRec, statusReq)

	if statusRec.Code != http.StatusOK {
		t.Fatalf("Expected HTTP 200 from get batch status, got %d %s", statusRec.Code, statusRec.Body.String())
	}

	// 6. Test Stale Job Sweeper recovery
	stuckSub := &models.Submission{
		ID:               uuid.New(),
		UserID:           finalSub.UserID,
		ProblemVersionID: finalSub.ProblemVersionID,
		Language:         "cpp23-gcc",
		SourceHash:       "deadbeef",
		Source:           "int main(){}",
		Status:           models.StatusRunning,
		Verdict:          models.VerdictPending,
		CreatedAt:        time.Now().UTC().Add(-10 * time.Minute), // Stuck for 10 minutes
	}
	if err := db.InsertSubmissionWithOutbox(ctx, stuckSub, map[string]string{"dummy": "job"}); err != nil {
		t.Fatalf("Failed to insert stuck submission: %v", err)
	}

	sweeperRunner := sweeper.NewSweeper(db, broker, 5*time.Minute, 1*time.Second)
	recoveredCount, err := sweeperRunner.SweepOnce(ctx)
	if err != nil {
		t.Fatalf("Sweeper returned error: %v", err)
	}
	if recoveredCount < 1 {
		t.Fatalf("Expected sweeper to recover at least 1 stuck submission, recovered: %d", recoveredCount)
	}

	// Verify stuck submission reached terminal SE
	recoveredSub, err := db.GetSubmission(ctx, stuckSub.ID)
	if err != nil || recoveredSub.Status != models.StatusDone || recoveredSub.Verdict != models.VerdictSE {
		t.Fatalf("Expected recovered submission to be DONE with SE verdict, got: %+v (err: %v)", recoveredSub, err)
	}
}
