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
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/complexity"
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
	"github.com/codebench/codebench/api/internal/verdict"
	"github.com/google/uuid"
)

// TestComplexityEnforcementPipeline verifies that the complexity evaluator correctly
// intercepts AC verdicts when a submission violates the problem's complexity policy.
func TestComplexityEnforcementPipeline(t *testing.T) {
	evaluator := complexity.NewEvaluator()

	// 1. Binary Search problem expecting O(log N)
	policy := &models.ComplexityPolicy{
		Policy:         "scaling",
		TimeComplexity: "O(log N)",
	}

	// Fake test results where instructions scaled by 250x between small and max-size
	linearScanTestResults := []models.JudgeTestResultDetail{
		{
			Ordinal:      1,
			GroupName:    "sample",
			Verdict:      models.VerdictAC,
			Instructions: 15000,
		},
		{
			Ordinal:      2,
			GroupName:    "small",
			Verdict:      models.VerdictAC,
			Instructions: 20000,
		},
		{
			Ordinal:      3,
			GroupName:    "max-size",
			Verdict:      models.VerdictAC,
			Instructions: 5000000, // 250x growth!
		},
	}

	finalVerdict, report := evaluator.Evaluate(policy, linearScanTestResults, models.VerdictAC)
	if finalVerdict != models.VerdictComplexityFail {
		t.Fatalf("Expected verdict COMPLEXITY_FAIL, got %s", finalVerdict)
	}
	if report == nil || report.Passed {
		t.Fatalf("Expected complexity report to fail, got %v", report)
	}
	if report.TargetComplexity != "O(log N)" {
		t.Errorf("Expected target complexity O(log N), got %s", report.TargetComplexity)
	}
}

// TestPracticeGenerationAndHistory verifies the Mode B practice generation endpoint
func TestPracticeGenerationAndHistory(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-practice-e2e-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-practice-token",
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

	// Seed reference problems if needed
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

	// 1. Create practice participant
	regBody, _ := json.Marshal(models.RegisterRequest{
		Name:     "Practice Runner",
		Email:    fmt.Sprintf("practice_%s@codebench.test", uuid.New().String()[:8]),
		Password: "PracticePassword123!",
	})
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("Failed to register practice user: %d %s", regRec.Code, regRec.Body.String())
	}
	userCookies := regRec.Result().Cookies()

	// 2. Generate a Custom Practice Set (Mode B)
	seedVal := int64(42)
	genBody, _ := json.Marshal(models.PracticeGenerateRequest{
		Count:           3,
		Difficulty:      "ANY",
		ExcludeSolved:   true,
		DurationMinutes: 60,
		Seed:            &seedVal,
	})
	genReq := httptest.NewRequest(http.MethodPost, "/api/practice/generate", bytes.NewReader(genBody))
	genReq.Header.Set("Content-Type", "application/json")
	for _, c := range userCookies {
		genReq.AddCookie(c)
	}
	genRec := httptest.NewRecorder()
	router.ServeHTTP(genRec, genReq)

	if genRec.Code != http.StatusCreated {
		t.Fatalf("Failed to generate practice set: code=%d body=%s", genRec.Code, genRec.Body.String())
	}

	var genResp models.PracticeGenerateResponse
	if err := json.Unmarshal(genRec.Body.Bytes(), &genResp); err != nil {
		t.Fatalf("Failed to parse practice response: %v", err)
	}

	if genResp.Mode != "practice" {
		t.Errorf("Expected mode 'practice', got '%s'", genResp.Mode)
	}
	if len(genResp.Problems) != 3 {
		t.Errorf("Expected 3 problems in practice set, got %d", len(genResp.Problems))
	}
	if genResp.Problems[0].Label != "A" || genResp.Problems[1].Label != "B" || genResp.Problems[2].Label != "C" {
		t.Errorf("Expected labels A, B, C, got %s, %s, %s",
			genResp.Problems[0].Label, genResp.Problems[1].Label, genResp.Problems[2].Label)
	}

	// 3. Verify user can access practice contest details via contest endpoint
	cReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/contests/%s", genResp.ContestID), nil)
	for _, c := range userCookies {
		cReq.AddCookie(c)
	}
	cRec := httptest.NewRecorder()
	router.ServeHTTP(cRec, cReq)

	if cRec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK accessing practice contest, got %d: %s", cRec.Code, cRec.Body.String())
	}

	// 4. Verify practice history
	histReq := httptest.NewRequest(http.MethodGet, "/api/practice/history", nil)
	for _, c := range userCookies {
		histReq.AddCookie(c)
	}
	histRec := httptest.NewRecorder()
	router.ServeHTTP(histRec, histReq)

	if histRec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK accessing practice history, got %d: %s", histRec.Code, histRec.Body.String())
	}
}
