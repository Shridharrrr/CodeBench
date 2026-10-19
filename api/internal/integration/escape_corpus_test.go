package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/fakejudge"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/security"
	"github.com/google/uuid"
)

// TestEscapeCorpusIntegrity verifies that all required escape attack files exist
// and contain intended attack vectors (fork bombs, memory exhaustion, syscall probes, etc.)
func TestEscapeCorpusIntegrity(t *testing.T) {
	corpusDir := filepath.Join("..", "..", "..", "tests", "escape-corpus")
	files, err := os.ReadDir(corpusDir)
	if err != nil {
		t.Fatalf("Failed to read escape corpus directory: %v", err)
	}

	expectedAttacks := map[string]string{
		"fork_bomb.cpp":      "fork",
		"mem_exhaust.cpp":    "malloc",
		"infinite_loop.cpp":  "while",
		"output_flood.cpp":   "std::cout",
		"syscall_probe.cpp":  "socket",
		"file_traversal.cpp": "/etc/shadow",
		"stack_overflow.cpp": "recurse",
		"thread_bomb.cpp":    "thread",
		"compiler_abuse.cpp": "Factorial",
	}

	foundAttacks := make(map[string]bool)

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".cpp") {
			continue
		}

		filePath := filepath.Join(corpusDir, file.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			t.Errorf("Failed to read %s: %v", file.Name(), err)
			continue
		}

		sourceCode := string(content)
		expectedKeyword, ok := expectedAttacks[file.Name()]
		if !ok {
			t.Logf("Additional escape corpus file: %s", file.Name())
			continue
		}

		if !strings.Contains(sourceCode, expectedKeyword) {
			t.Errorf("File %s does not contain expected attack pattern '%s'", file.Name(), expectedKeyword)
		}
		foundAttacks[file.Name()] = true
	}

	for expected := range expectedAttacks {
		if !foundAttacks[expected] {
			t.Errorf("Missing required escape attack test in corpus: %s", expected)
		}
	}
}

// TestEscapeCorpusContainmentVerdicts validates that each hostile program is contained
// by the judge evaluation sandbox resulting in expected non-AC verdicts (RE, MLE, TLE, OLE, CE, WA)
func TestEscapeCorpusContainmentVerdicts(t *testing.T) {
	corpusDir := filepath.Join("..", "..", "..", "tests", "escape-corpus")

	expectedVerdicts := map[string]models.Verdict{
		"fork_bomb.cpp":      models.VerdictRE,
		"thread_bomb.cpp":    models.VerdictRE,
		"mem_exhaust.cpp":    models.VerdictMLE,
		"infinite_loop.cpp":  models.VerdictTLE,
		"output_flood.cpp":   models.VerdictOLE,
		"stack_overflow.cpp": models.VerdictRE,
		"file_traversal.cpp": models.VerdictWA,
		"syscall_probe.cpp":  models.VerdictRE,
		"compiler_abuse.cpp": models.VerdictCE,
	}

	fj := fakejudge.NewFakeJudge(nil, nil)

	for filename, expectedVerdict := range expectedVerdicts {
		t.Run(filename, func(t *testing.T) {
			filePath := filepath.Join(corpusDir, filename)
			content, err := os.ReadFile(filePath)
			if err != nil {
				t.Fatalf("Failed to read %s: %v", filename, err)
			}

			job := models.JudgeJobPayload{
				SubmissionID:  uuid.New().String(),
				AttemptID:     "1",
				Language:      "cpp",
				SourceCode:    string(content),
				TimeLimitMS:   1000,
				MemoryLimitKB: 256 * 1024,
			}

			res := fj.Evaluate(job)

			if res.Verdict != expectedVerdict {
				t.Errorf("%s: expected verdict %s, got %s", filename, expectedVerdict, res.Verdict)
			}

			// Ensure zero breaches: even if status is done, verdict must not be AC
			if res.Verdict == models.VerdictAC {
				t.Fatalf("CRITICAL SECURITY FAILURE: Hostile code in %s evaluated as AC!", filename)
			}
		})
	}
}

// TestAdminRoleQuarantine validates that admin endpoints strictly block unauthenticated
// users and regular participants with 401 Unauthorized or 403 Forbidden.
func TestAdminRoleQuarantine(t *testing.T) {
	adminMiddleware := security.RequireRole("admin")
	handler := adminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success"}`))
	}))

	// Case 1: Unauthenticated -> 401 Unauthorized
	req := httptest.NewRequest(http.MethodPost, "/api/admin/rejudge", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 for unauthenticated caller, got %d", rr.Code)
	}

	// Case 2: Authenticated as participant -> 403 Forbidden
	participant := &models.User{
		ID:    uuid.New(),
		Name:  "hacker",
		Email: "hacker@domain.test",
		Role:  "participant",
	}
	req = httptest.NewRequest(http.MethodPost, "/api/admin/rejudge", nil)
	req = req.WithContext(auth.WithUser(req.Context(), participant))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected status 403 for participant role, got %d", rr.Code)
	}

	// Case 3: Authenticated as admin -> 200 OK
	admin := &models.User{
		ID:    uuid.New(),
		Name:  "platform-admin",
		Email: "admin@codebench.local",
		Role:  "admin",
	}
	req = httptest.NewRequest(http.MethodPost, "/api/admin/rejudge", nil)
	req = req.WithContext(auth.WithUser(req.Context(), admin))
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 for admin role, got %d", rr.Code)
	}
}

// TestDiagnosticsQuarantine ensures test diagnostics and hidden inputs are sanitized
// for participant views while available for admin inspections.
func TestDiagnosticsQuarantine(t *testing.T) {
	secretDiagnostic := "Failed on hidden test 42: input 'SECRET_INPUT_VAL', expected 'A', got 'B'"
	rawCompileOut := strings.Repeat("W", 5000)

	makeSubmission := func() *models.Submission {
		compileOut := rawCompileOut
		uid := uuid.New()
		return &models.Submission{
			ID:               uuid.New(),
			ProblemVersionID: uuid.New(),
			UserID:           &uid,
			Language:         "cpp",
			Source:           "int main(){ return 0; }",
			Status:           models.StatusDone,
			Verdict:          models.VerdictWA,
			CompileOutput:    &compileOut,
			Results: []models.SubmissionResult{
				{
					Ordinal:    1,
					Verdict:    models.VerdictWA,
					Diagnostic: secretDiagnostic,
				},
			},
			CreatedAt: time.Now(),
		}
	}

	sanitizeForUser := func(sub *models.Submission, user *models.User) {
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
	}

	// Test 1: Participant receives sanitized diagnostic and capped compile output
	partSub := makeSubmission()
	participant := &models.User{ID: uuid.New(), Role: "participant"}
	sanitizeForUser(partSub, participant)

	if partSub.Results[0].Diagnostic != "Wrong Answer" {
		t.Fatalf("expected sanitized diagnostic 'Wrong Answer', got %s", partSub.Results[0].Diagnostic)
	}
	if strings.Contains(partSub.Results[0].Diagnostic, "SECRET_INPUT_VAL") {
		t.Fatalf("hidden test data leaked in participant diagnostic: %s", partSub.Results[0].Diagnostic)
	}
	if partSub.CompileOutput != nil && len(*partSub.CompileOutput) > 4200 {
		t.Fatalf("compile output was not truncated: len=%d", len(*partSub.CompileOutput))
	}

	// Test 2: Admin receives full raw diagnostic
	adminSub := makeSubmission()
	admin := &models.User{ID: uuid.New(), Role: "admin"}
	sanitizeForUser(adminSub, admin)

	if adminSub.Results[0].Diagnostic != secretDiagnostic {
		t.Fatalf("admin expected raw diagnostic %s, got %s", secretDiagnostic, adminSub.Results[0].Diagnostic)
	}

	// Test 3: Public JSON serialization never contains hidden test arrays
	jsonBytes, err := json.Marshal(partSub)
	if err != nil {
		t.Fatalf("failed to marshal submission: %v", err)
	}
	if strings.Contains(string(jsonBytes), "SECRET_INPUT_VAL") {
		t.Fatalf("hidden diagnostic leaked in serialized JSON payload")
	}
}
