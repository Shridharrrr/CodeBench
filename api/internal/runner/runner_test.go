package runner

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/models"
)

func TestRunnerSampleCases_AC(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	source := `#include <iostream>
int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << "\n";
    }
    return 0;
}`
	samples := []models.TestCase{
		{Ordinal: 1, GroupName: "sample", InputData: "2 3", OutputData: "5", IsSample: true},
		{Ordinal: 2, GroupName: "sample", InputData: "10 20", OutputData: "30", IsSample: true},
	}

	resp, err := RunSampleCases(ctx, "cpp23-gcc", source, samples, "", 1000)
	if err != nil {
		t.Fatalf("RunSampleCases failed: %v", err)
	}

	if resp.Verdict != string(models.VerdictAC) {
		t.Fatalf("Expected verdict AC, got %s", resp.Verdict)
	}
	if len(resp.SampleResults) != 2 {
		t.Fatalf("Expected 2 sample results, got %d", len(resp.SampleResults))
	}
	for i, r := range resp.SampleResults {
		if r.Verdict != string(models.VerdictAC) {
			t.Errorf("Sample %d expected AC, got %s (%s)", i+1, r.Verdict, r.Diagnostic)
		}
	}
}

func TestRunnerSampleCases_WA(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	source := `#include <iostream>
// WA
int main() {
    std::cout << "-1 -1\n";
    return 0;
}`
	samples := []models.TestCase{
		{Ordinal: 1, GroupName: "sample", InputData: "4 9\n2 7 11 15", OutputData: "0 1", IsSample: true},
	}

	resp, err := RunSampleCases(ctx, "cpp23-gcc", source, samples, "", 1000)
	if err != nil {
		t.Fatalf("RunSampleCases failed: %v", err)
	}

	if resp.Verdict != string(models.VerdictWA) {
		t.Fatalf("Expected verdict WA, got %s", resp.Verdict)
	}
}

func TestRunnerSampleCases_CE(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	source := `// CE
int main() { syntax_error_here }`
	samples := []models.TestCase{
		{Ordinal: 1, GroupName: "sample", InputData: "1", OutputData: "1", IsSample: true},
	}

	resp, err := RunSampleCases(ctx, "cpp23-gcc", source, samples, "", 1000)
	if err != nil {
		t.Fatalf("RunSampleCases failed: %v", err)
	}

	if resp.Verdict != string(models.VerdictCE) {
		t.Fatalf("Expected verdict CE, got %s", resp.Verdict)
	}
	if resp.CompileOutput == "" {
		t.Fatalf("Expected non-empty CompileOutput on CE")
	}
}

func TestRunnerCustomInput(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	source := `#include <iostream>
int main() {
    std::cout << "0 1\n";
    return 0;
}`
	resp, err := RunSampleCases(ctx, "cpp23-gcc", source, nil, "custom input data", 1000)
	if err != nil {
		t.Fatalf("RunSampleCases with custom input failed: %v", err)
	}

	if len(resp.SampleResults) != 1 {
		t.Fatalf("Expected 1 result for custom input, got %d", len(resp.SampleResults))
	}
	if resp.SampleResults[0].GroupName != "custom" {
		t.Fatalf("Expected group 'custom', got %s", resp.SampleResults[0].GroupName)
	}
}

func TestWrapWithDriver_FunctionBased(t *testing.T) {
	leetcodeFunc := `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {0, 1};
    }
};`

	wrapped := WrapWithDriver("two-sum", "cpp23-gcc", leetcodeFunc)
	if !strings.Contains(wrapped, "class Solution") {
		t.Fatalf("Expected wrapped code to contain class Solution")
	}
	if !strings.Contains(wrapped, "int main()") {
		t.Fatalf("Expected wrapped code to contain int main() driver")
	}
	if !strings.Contains(wrapped, "sol.twoSum(nums, target)") {
		t.Fatalf("Expected driver to call sol.twoSum")
	}

	// Code with main should NOT be wrapped
	codeWithMain := "int main() { return 0; }"
	notWrapped := WrapWithDriver("two-sum", "cpp23-gcc", codeWithMain)
	if notWrapped != codeWithMain {
		t.Fatalf("Expected code with main to remain unchanged")
	}
}
