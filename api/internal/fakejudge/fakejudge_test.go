package fakejudge

import (
	"testing"

	"github.com/codebench/codebench/api/internal/models"
)

func TestFakeJudgeEvaluation(t *testing.T) {
	fj := NewFakeJudge(nil, nil)

	// 1. Test AC
	acJob := models.JudgeJobPayload{
		SubmissionID: "sub-1",
		AttemptID:    "att-1",
		Language:     "cpp23-gcc",
		SourceCode:   "// AC solution\n#include <iostream>\nint main() { return 0; }",
		TimeLimitMS:  1000,
		TestCases: []models.TestCase{
			{GroupName: "sample", Ordinal: 1},
			{GroupName: "small", Ordinal: 2},
		},
	}
	resAC := fj.evaluate(acJob)
	if resAC.Verdict != models.VerdictAC {
		t.Errorf("Expected AC verdict, got %v", resAC.Verdict)
	}
	if len(resAC.TestResults) != 2 {
		t.Errorf("Expected 2 test results, got %d", len(resAC.TestResults))
	}

	// 2. Test WA
	waJob := models.JudgeJobPayload{
		SubmissionID: "sub-2",
		SourceCode:   "// WA\nstd::cout << -1 -1;",
		TimeLimitMS:  1000,
	}
	resWA := fj.evaluate(waJob)
	if resWA.Verdict != models.VerdictWA {
		t.Errorf("Expected WA verdict, got %v", resWA.Verdict)
	}

	// 3. Test TLE
	tleJob := models.JudgeJobPayload{
		SubmissionID: "sub-3",
		SourceCode:   "// TLE infinite loop",
		TimeLimitMS:  1000,
	}
	resTLE := fj.evaluate(tleJob)
	if resTLE.Verdict != models.VerdictTLE {
		t.Errorf("Expected TLE verdict, got %v", resTLE.Verdict)
	}
	if resTLE.TotalTimeMS <= 1000 {
		t.Errorf("Expected time > 1000ms for TLE, got %d", resTLE.TotalTimeMS)
	}

	// 4. Test CE
	ceJob := models.JudgeJobPayload{
		SubmissionID: "sub-4",
		SourceCode:   "// CE\nsyntax_error_here",
		TimeLimitMS:  1000,
	}
	resCE := fj.evaluate(ceJob)
	if resCE.Verdict != models.VerdictCE {
		t.Errorf("Expected CE verdict, got %v", resCE.Verdict)
	}
	if resCE.CompileOutput == "" {
		t.Errorf("Expected non-empty compile output for CE")
	}
}
