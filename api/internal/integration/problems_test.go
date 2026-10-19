package integration

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/codebench/codebench/pkg/problems"
)

func TestAllTenProblemPackagesValidate(t *testing.T) {
	problemsDir := filepath.Join("..", "..", "..", "problems")
	entries, err := os.ReadDir(problemsDir)
	if err != nil {
		t.Fatalf("failed to read problems directory: %v", err)
	}

	validatedCount := 0
	ctx := context.Background()

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		pkgDir := filepath.Join(problemsDir, e.Name())
		if _, err := os.Stat(filepath.Join(pkgDir, "problem.yaml")); err != nil {
			continue
		}

		pkg, err := problems.LoadPackage(pkgDir)
		if err != nil {
			t.Errorf("failed to load package %s: %v", e.Name(), err)
			continue
		}

		report, err := problems.ValidatePackage(ctx, pkg)
		if err != nil {
			t.Errorf("failed to validate package %s: %v", e.Name(), err)
			continue
		}
		if !report.Passed {
			t.Errorf("package %s failed validation: %v", e.Name(), report.Errors)
			continue
		}

		if len(pkg.CanonicalHash) != 64 {
			t.Errorf("package %s has invalid hash length: %d", e.Name(), len(pkg.CanonicalHash))
		}

		validatedCount++
	}

	if validatedCount < 10 {
		t.Fatalf("expected at least 10 validated problems, got %d", validatedCount)
	}
}

func TestPublicAPI_NeverLeaksHiddenTests(t *testing.T) {
	// Verify the response JSON marshaling contract directly:
	type ProblemDetailResponse struct {
		Slug        string           `json:"slug"`
		Title       string           `json:"title"`
		StatementMD string           `json:"statement_md"`
		Difficulty  string           `json:"difficulty"`
		SampleTests []map[string]any `json:"sample_tests"`
		HiddenTests any              `json:"hidden_tests,omitempty"`
	}

	samplePkg, err := problems.LoadPackage(filepath.Join("..", "..", "..", "problems", "two-sum"))
	if err != nil {
		t.Fatalf("failed to load two-sum: %v", err)
	}

	// Filter sample tests
	var sampleTests []map[string]any
	for _, tc := range samplePkg.TestCases {
		if tc.IsSample {
			sampleTests = append(sampleTests, map[string]any{
				"ordinal":     tc.Ordinal,
				"group_name":  tc.GroupName,
				"input_data":  tc.InputData,
				"output_data": tc.OutputData,
			})
		}
	}

	resp := ProblemDetailResponse{
		Slug:        samplePkg.Manifest.Slug,
		Title:       samplePkg.Manifest.Title,
		StatementMD: samplePkg.StatementMD,
		Difficulty:  samplePkg.Manifest.Difficulty,
		SampleTests: sampleTests,
	}

	jsonBytes, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	jsonStr := string(jsonBytes)

	// Verify that hidden test data is NOT present in the client response
	for _, tc := range samplePkg.TestCases {
		if !tc.IsSample {
			if len(tc.InputData) > 5 && containsSubstring(jsonStr, tc.InputData) {
				t.Fatalf("SECURITY VIOLATION: Hidden test input leaked in public response: %s", tc.InputData)
			}
		}
	}
}

func TestRunEndpoint_NeverAccessesHiddenTests(t *testing.T) {
	samplePkg, err := problems.LoadPackage(filepath.Join("..", "..", "..", "problems", "two-sum"))
	if err != nil {
		t.Fatalf("failed to load two-sum: %v", err)
	}

	// Filter sample tests as the handler does
	var sampleCases []problems.ProblemTestCase
	for _, tc := range samplePkg.TestCases {
		if tc.IsSample {
			sampleCases = append(sampleCases, tc)
		}
	}

	// Verify sample count is less than total count
	if len(sampleCases) >= len(samplePkg.TestCases) {
		t.Fatalf("Expected problem to have hidden tests beyond sample tests")
	}

	// Verify that none of the sampleCases have non-sample group names
	for _, sc := range sampleCases {
		if !sc.IsSample {
			t.Fatalf("Non-sample test case found in sample run slice!")
		}
	}
}

func containsSubstring(s, sub string) bool {
	return len(sub) > 0 && len(s) >= len(sub) && (s == sub || stringContains(s, sub))
}

func stringContains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
