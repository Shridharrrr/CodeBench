package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

func TestAuthAndSubmissionLifecycle(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-auth-sub-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-auth-token",
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

	// Connect to PostgreSQL database if running, otherwise verify using memory mock
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

	// Start outbox relay, standings manager & verdict consumer
	relay := outbox.NewRelay(db, queueMgr, 20*time.Millisecond)
	go relay.Start(ctx)

	standingsMgr := standings.NewManager(db, broker)
	vConsumer := verdict.NewConsumer(db, queueMgr, broker, standingsMgr)
	if err := vConsumer.Start(ctx); err != nil {
		t.Fatalf("Failed to start verdict consumer: %v", err)
	}

	server := handlers.NewServer(db, queueMgr, broker, standingsMgr)
	router := server.Router()

	// 1. Test Registration
	regBody, _ := json.Marshal(models.RegisterRequest{
		Name:     "Test Participant",
		Email:    "participant_" + uuid.New().String()[:8] + "@codebench.test",
		Password: "SecurePassword123!",
	})
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("Registration failed: status %d, body %s", regRec.Code, regRec.Body.String())
	}

	// Verify session cookie
	var sessionCookie *http.Cookie
	for _, c := range regRec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatalf("Expected %s cookie in registration response", auth.SessionCookieName)
	}

	var authResp models.AuthResponse
	_ = json.Unmarshal(regRec.Body.Bytes(), &authResp)
	if authResp.CSRFToken == "" {
		t.Fatalf("Expected non-empty CSRFToken in response")
	}

	// 2. Test GET /api/auth/me with session cookie
	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(sessionCookie)
	meRec := httptest.NewRecorder()
	router.ServeHTTP(meRec, meReq)

	if meRec.Code != http.StatusOK {
		t.Fatalf("GET /api/auth/me failed: status %d, body %s", meRec.Code, meRec.Body.String())
	}

	// 3. Test Sample Run POST /api/problems/two-sum/run
	runBody, _ := json.Marshal(models.RunRequest{
		Language: "cpp23-gcc",
		Source:   "// AC\n#include <iostream>\nint main() { std::cout << 0 << ' ' << 1; return 0; }",
	})
	runReq := httptest.NewRequest(http.MethodPost, "/api/problems/two-sum/run", bytes.NewReader(runBody))
	runReq.Header.Set("Content-Type", "application/json")
	runRec := httptest.NewRecorder()
	router.ServeHTTP(runRec, runReq)

	if runRec.Code != http.StatusOK {
		t.Fatalf("Sample run failed: status %d, body %s", runRec.Code, runRec.Body.String())
	}

	var runResp models.RunResponse
	if err := json.Unmarshal(runRec.Body.Bytes(), &runResp); err != nil {
		t.Fatalf("Failed to decode sample run response: %v", err)
	}
	if runResp.Verdict != "AC" {
		t.Fatalf("Expected sample run verdict AC, got %s", runResp.Verdict)
	}

	// 4. Test Submission POST /api/problems/two-sum/submit
	subBody, _ := json.Marshal(models.SubmitRequest{
		Language: "cpp23-gcc",
		Source:   "// AC\n#include <iostream>\nint main() { std::cout << 0 << ' ' << 1; return 0; }",
	})
	subReq := httptest.NewRequest(http.MethodPost, "/api/problems/two-sum/submit", bytes.NewReader(subBody))
	subReq.Header.Set("Content-Type", "application/json")
	subReq.Header.Set("X-CSRF-Token", authResp.CSRFToken)
	subReq.AddCookie(sessionCookie)
	subRec := httptest.NewRecorder()
	router.ServeHTTP(subRec, subReq)

	if subRec.Code != http.StatusAccepted {
		t.Fatalf("Submission failed: status %d, body %s", subRec.Code, subRec.Body.String())
	}

	var subResp models.SubmitResponse
	if err := json.Unmarshal(subRec.Body.Bytes(), &subResp); err != nil {
		t.Fatalf("Failed to parse submit response: %v", err)
	}

	subUUID, err := uuid.Parse(subResp.SubmissionID)
	if err != nil {
		t.Fatalf("Invalid submission uuid returned: %v", err)
	}

	// 5. Poll for completed verdict
	deadline := time.Now().Add(5 * time.Second)
	var finalSub *models.Submission
	for time.Now().Before(deadline) {
		sub, err := db.GetSubmission(ctx, subUUID)
		if err == nil && sub.Verdict != models.VerdictPending {
			finalSub = sub
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	if finalSub == nil {
		t.Fatalf("Timed out waiting for submission verdict to be recorded")
	}

	if finalSub.Verdict != models.VerdictAC {
		t.Fatalf("Expected final verdict AC, got %s", finalSub.Verdict)
	}
	if finalSub.UserID == nil || *finalSub.UserID != authResp.User.ID {
		t.Fatalf("Expected submission user_id to match authenticated user %v, got %v", authResp.User.ID, finalSub.UserID)
	}

	// 6. Test GET /api/submissions with filter
	listReq := httptest.NewRequest(http.MethodGet, "/api/submissions?slug=two-sum", nil)
	listReq.AddCookie(sessionCookie)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("GET /api/submissions failed: status %d", listRec.Code)
	}
}
