package complexity

import (
	"testing"

	"github.com/codebench/codebench/api/internal/models"
)

func TestQueryBudgetEvaluation(t *testing.T) {
	eval := NewEvaluator()

	policy := &models.ComplexityPolicy{
		Policy:         "query_budget",
		TimeComplexity: "O(log N)",
		MaxQueries:     25,
	}

	// 1. Solution within query budget
	resultsWithin := []models.JudgeTestResultDetail{
		{
			Ordinal:    1,
			GroupName:  "sample",
			Verdict:    models.VerdictAC,
			Diagnostic: "queries: 18",
		},
	}
	verdict, report := eval.Evaluate(policy, resultsWithin, models.VerdictAC)
	if verdict != models.VerdictAC {
		t.Errorf("expected AC, got %s", verdict)
	}
	if !report.Passed {
		t.Errorf("expected report to pass, got failed")
	}
	if report.QueryCount != 18 {
		t.Errorf("expected query count 18, got %d", report.QueryCount)
	}

	// 2. Solution exceeding query budget
	resultsExceeded := []models.JudgeTestResultDetail{
		{
			Ordinal:    1,
			GroupName:  "max-size",
			Verdict:    models.VerdictAC,
			Diagnostic: "Accesses: 1000",
		},
	}
	verdictFail, reportFail := eval.Evaluate(policy, resultsExceeded, models.VerdictAC)
	if verdictFail != models.VerdictComplexityFail {
		t.Errorf("expected COMPLEXITY_FAIL, got %s", verdictFail)
	}
	if reportFail.Passed {
		t.Errorf("expected report to fail, got passed")
	}
	if reportFail.QueryCount != 1000 {
		t.Errorf("expected query count 1000, got %d", reportFail.QueryCount)
	}
}

func TestInstructionScalingEvaluation_LogN(t *testing.T) {
	eval := NewEvaluator()

	policy := &models.ComplexityPolicy{
		Policy:         "scaling",
		TimeComplexity: "O(log N)",
	}

	// 1. Conforming binary search (small: 20,000 inst, max-size: 80,000 inst -> ratio 4x)
	conformingResults := []models.JudgeTestResultDetail{
		{
			Ordinal:      1,
			GroupName:    "small",
			Verdict:      models.VerdictAC,
			Instructions: 20000,
		},
		{
			Ordinal:      2,
			GroupName:    "max-size",
			Verdict:      models.VerdictAC,
			Instructions: 80000,
		},
	}
	v1, r1 := eval.Evaluate(policy, conformingResults, models.VerdictAC)
	if v1 != models.VerdictAC {
		t.Errorf("expected AC for conforming binary search, got %s", v1)
	}
	if !r1.Passed {
		t.Errorf("expected conforming binary search to pass report, got failed")
	}

	// 2. Linear scan pretending to be binary search (small: 20,000 inst, max-size: 4,000,000 inst -> ratio 200x)
	linearScanResults := []models.JudgeTestResultDetail{
		{
			Ordinal:      1,
			GroupName:    "small",
			Verdict:      models.VerdictAC,
			Instructions: 20000,
		},
		{
			Ordinal:      2,
			GroupName:    "max-size",
			Verdict:      models.VerdictAC,
			Instructions: 4000000,
		},
	}
	v2, r2 := eval.Evaluate(policy, linearScanResults, models.VerdictAC)
	if v2 != models.VerdictComplexityFail {
		t.Errorf("expected COMPLEXITY_FAIL for linear scan on O(log N) problem, got %s", v2)
	}
	if r2.Passed {
		t.Errorf("expected linear scan to fail complexity report")
	}
	if r2.Diagnostic == "" {
		t.Errorf("expected diagnostic message explaining failure")
	}
}

func TestEstimateComplexityClass(t *testing.T) {
	if got := EstimateComplexityClass(1.5); got != "O(1)" {
		t.Errorf("expected O(1), got %s", got)
	}
	if got := EstimateComplexityClass(8.0); got != "O(log N)" {
		t.Errorf("expected O(log N), got %s", got)
	}
	if got := EstimateComplexityClass(120.0); got != "O(N)" {
		t.Errorf("expected O(N), got %s", got)
	}
	if got := EstimateComplexityClass(3500.0); got != "O(N log N)" {
		t.Errorf("expected O(N log N), got %s", got)
	}
	if got := EstimateComplexityClass(80000.0); got != "O(N^2)" {
		t.Errorf("expected O(N^2), got %s", got)
	}
}
