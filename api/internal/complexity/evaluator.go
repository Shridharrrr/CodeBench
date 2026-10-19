package complexity

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/codebench/codebench/api/internal/models"
)

var (
	queryRegex = regexp.MustCompile(`(?i)(?:queries|query_count|accesses|calls)[:= ]+(\d+)`)
)

// Evaluator evaluates submission test metrics against a problem's complexity policy
type Evaluator struct{}

func NewEvaluator() *Evaluator {
	return &Evaluator{}
}

// Evaluate analyzes test results against problem complexity policy.
// If a complexity violation is detected, it overrides an AC verdict to COMPLEXITY_FAIL.
func (e *Evaluator) Evaluate(
	policy *models.ComplexityPolicy,
	testResults []models.JudgeTestResultDetail,
	currentVerdict models.Verdict,
) (models.Verdict, *models.ComplexityReport) {
	if policy == nil || (policy.Policy == "" && policy.TimeComplexity == "") {
		return currentVerdict, nil
	}

	report := &models.ComplexityReport{
		Policy:           policy.Policy,
		TargetComplexity: policy.TimeComplexity,
		SpaceComplexity:  policy.SpaceComplexity,
		Passed:           true,
	}

	// 1. Check Query Budget / Interactor access budget
	maxQueries := policy.MaxQueries
	maxQueriesFound := 0

	for _, tr := range testResults {
		// Parse query count from test diagnostics if present
		if tr.Diagnostic != "" {
			if matches := queryRegex.FindStringSubmatch(tr.Diagnostic); len(matches) > 1 {
				if q, err := strconv.Atoi(matches[1]); err == nil && q > maxQueriesFound {
					maxQueriesFound = q
				}
			}
		}
	}

	if maxQueries > 0 {
		report.QueryLimit = maxQueries
		report.QueryCount = maxQueriesFound
		if maxQueriesFound > maxQueries {
			report.Passed = false
			report.Diagnostic = fmt.Sprintf("COMPLEXITY_FAIL: used %d queries, limit %d", maxQueriesFound, maxQueries)
			if currentVerdict == models.VerdictAC {
				return models.VerdictComplexityFail, report
			}
			return currentVerdict, report
		}
	}

	// 2. Retired-Instruction Scaling Analysis
	// Group tests by group_name ("small" vs "max-size" or "large")
	var smallInst, maxInst int64
	var smallCount, maxCount int

	for _, tr := range testResults {
		groupLower := strings.ToLower(tr.GroupName)
		if strings.Contains(groupLower, "small") && tr.Instructions > 0 {
			smallInst += tr.Instructions
			smallCount++
		} else if (strings.Contains(groupLower, "max") || strings.Contains(groupLower, "large")) && tr.Instructions > 0 {
			maxInst += tr.Instructions
			maxCount++
		}
	}

	if smallCount > 0 && maxCount > 0 {
		avgSmall := float64(smallInst) / float64(smallCount)
		avgMax := float64(maxInst) / float64(maxCount)

		if avgSmall > 0 {
			ratio := avgMax / avgSmall
			report.MeasuredScaling = fmt.Sprintf("Scale ratio: %.1fx", ratio)

			target := strings.ToUpper(strings.TrimSpace(policy.TimeComplexity))

			// Check O(log N) or O(1) policies
			if target == "O(LOG N)" || target == "O(1)" {
				// In O(log N) or O(1), instructions should scale very sublinearly (ratio usually < 15x).
				// A linear O(N) scan typically exhibits ratio > 50x between small and max-size test cases.
				if ratio > 60.0 {
					report.Passed = false
					report.Diagnostic = fmt.Sprintf(
						"COMPLEXITY_FAIL: non-linear scaling detected (measured %.1fx growth between small and max-size tests; expected %s)",
						ratio, policy.TimeComplexity,
					)
					if currentVerdict == models.VerdictAC {
						return models.VerdictComplexityFail, report
					}
					return currentVerdict, report
				}
			} else if target == "O(N)" || target == "O(N LOG N)" {
				// In linear or linearithmic problems, quadratic O(N^2) algorithms scale by (N_max/N_small)^2
				// If ratio is excessively higher than expected linear scaling (e.g. > 10,000x for 100x size delta):
				if ratio > 5000.0 && avgMax > 1e8 {
					report.Passed = false
					report.Diagnostic = fmt.Sprintf(
						"COMPLEXITY_FAIL: super-linear/quadratic scaling detected (measured %.1fx growth; expected %s)",
						ratio, policy.TimeComplexity,
					)
					if currentVerdict == models.VerdictAC {
						return models.VerdictComplexityFail, report
					}
					return currentVerdict, report
				}
			}
		}
	}

	if report.MeasuredScaling == "" {
		report.MeasuredScaling = "Conforming to " + policy.TimeComplexity
	}

	return currentVerdict, report
}

// EstimateComplexityClass provides a human-readable estimate of scaling order
func EstimateComplexityClass(ratio float64) string {
	if ratio <= 2.0 {
		return "O(1)"
	} else if ratio <= 15.0 {
		return "O(log N)"
	} else if ratio <= 1500.0 {
		return "O(N)"
	} else if ratio <= 15000.0 {
		return "O(N log N)"
	}
	return "O(N^2)"
}

func log2(n float64) float64 {
	return math.Log2(n)
}
