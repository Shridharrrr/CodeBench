package integration

import (
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/fakejudge"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

// TestSetupAcceptance_FullLifecycleBudgets validates the end-to-end Setup Acceptance Test:
// - Reference solution execution achieves AC within time and memory limit budgets
// - Wrong answer solution achieves WA within time budget
// - Time Limit Exceeded (infinite loop) properly terminates with TLE
// - Memory Limit Exceeded properly terminates with MLE
func TestSetupAcceptance_FullLifecycleBudgets(t *testing.T) {
	fj := fakejudge.NewFakeJudge(nil, nil)

	t.Run("ReferenceSolution_Acceptance_AC", func(t *testing.T) {
		job := models.JudgeJobPayload{
			SubmissionID:  uuid.New().String(),
			AttemptID:     "1",
			Language:      "cpp",
			SourceCode:    "#include <iostream>\nint main() { std::cout << 3 << std::endl; return 0; }",
			TimeLimitMS:   1000,
			MemoryLimitKB: 256 * 1024,
			TestCases: []models.TestCase{
				{
					ID:        uuid.New(),
					Ordinal:   1,
					GroupName: "sample",
					IsSample:  true,
				},
				{
					ID:        uuid.New(),
					Ordinal:   2,
					GroupName: "large-bounds",
					IsSample:  false,
				},
			},
		}

		start := time.Now()
		verdict := fj.Evaluate(job)
		elapsed := time.Since(start)

		if verdict.Verdict != models.VerdictAC {
			t.Fatalf("Reference solution failed to get AC: got %s", verdict.Verdict)
		}
		if verdict.TotalTimeMS > job.TimeLimitMS {
			t.Fatalf("Reference solution exceeded time limit: %dms > %dms", verdict.TotalTimeMS, job.TimeLimitMS)
		}
		if verdict.PeakMemoryKB > job.MemoryLimitKB {
			t.Fatalf("Reference solution exceeded memory limit: %dKB > %dKB", verdict.PeakMemoryKB, job.MemoryLimitKB)
		}
		if elapsed > 1*time.Second {
			t.Fatalf("SAT overhead too high: took %v", elapsed)
		}
	})

	t.Run("WrongSolution_Rejection_WA", func(t *testing.T) {
		job := models.JudgeJobPayload{
			SubmissionID:  uuid.New().String(),
			AttemptID:     "1",
			Language:      "cpp",
			SourceCode:    "// WA\n#include <iostream>\nint main() { std::cout << -1 << ' ' << -1 << std::endl; return 0; }",
			TimeLimitMS:   1000,
			MemoryLimitKB: 256 * 1024,
		}

		verdict := fj.Evaluate(job)
		if verdict.Verdict != models.VerdictWA {
			t.Fatalf("Wrong solution expected WA, got %s", verdict.Verdict)
		}
	})

	t.Run("InfiniteLoop_Rejection_TLE", func(t *testing.T) {
		job := models.JudgeJobPayload{
			SubmissionID:  uuid.New().String(),
			AttemptID:     "1",
			Language:      "cpp",
			SourceCode:    "// TLE\nint main() { while(true){} return 0; }",
			TimeLimitMS:   1000,
			MemoryLimitKB: 256 * 1024,
		}

		verdict := fj.Evaluate(job)
		if verdict.Verdict != models.VerdictTLE {
			t.Fatalf("Infinite loop expected TLE, got %s", verdict.Verdict)
		}
	})

	t.Run("MemoryExhaustion_Rejection_MLE", func(t *testing.T) {
		job := models.JudgeJobPayload{
			SubmissionID:  uuid.New().String(),
			AttemptID:     "1",
			Language:      "cpp",
			SourceCode:    "// MLE\nint main() { void* p = malloc(1024*1024*1024); return 0; }",
			TimeLimitMS:   1000,
			MemoryLimitKB: 256 * 1024,
		}

		verdict := fj.Evaluate(job)
		if verdict.Verdict != models.VerdictMLE {
			t.Fatalf("Memory exhaustion expected MLE, got %s", verdict.Verdict)
		}
	})
}
