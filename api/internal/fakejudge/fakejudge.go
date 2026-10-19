package fakejudge

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/nats-io/nats.go"
)

type FakeJudge struct {
	queueMgr *queue.NATSManager
	broker   *events.Broker
}

func NewFakeJudge(queueMgr *queue.NATSManager, broker *events.Broker) *FakeJudge {
	return &FakeJudge{
		queueMgr: queueMgr,
		broker:   broker,
	}
}

func (fj *FakeJudge) Start(ctx context.Context) error {
	js := fj.queueMgr.JetStream()

	sub, err := js.QueueSubscribe("jobs.>", "fake-judge-workers", func(msg *nats.Msg) {
		var job models.JudgeJobPayload
		if err := json.Unmarshal(msg.Data, &job); err != nil {
			slog.Error("Fake judge failed to unmarshal job payload", "error", err)
			_ = msg.Term()
			return
		}

		slog.Info("Fake judge processing submission job", "submission_id", job.SubmissionID, "language", job.Language)

		// Broadcast COMPILING
		if fj.broker != nil {
			fj.broker.PublishSubmissionStatus(job.SubmissionID, models.StatusCompiling, models.VerdictPending, nil)
		}
		time.Sleep(100 * time.Millisecond)

		// Broadcast RUNNING
		if fj.broker != nil {
			fj.broker.PublishSubmissionStatus(job.SubmissionID, models.StatusRunning, models.VerdictPending, nil)
		}
		time.Sleep(100 * time.Millisecond)

		verdictPayload := fj.evaluate(job)

		// Publish verdict to NATS verdicts.submissions
		data, err := json.Marshal(verdictPayload)
		if err != nil {
			slog.Error("Fake judge failed to marshal verdict", "error", err)
			_ = msg.Nak()
			return
		}

		_, err = js.Publish("verdicts.submissions", data)
		if err != nil {
			slog.Error("Fake judge failed to publish verdict to NATS", "error", err)
			_ = msg.NakWithDelay(500 * time.Millisecond)
			return
		}

		_ = msg.Ack()
		slog.Info("Fake judge finished judging", "submission_id", job.SubmissionID, "verdict", verdictPayload.Verdict)
	}, nats.Durable("fake-judge-worker"), nats.ManualAck())

	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		_ = sub.Unsubscribe()
	}()

	slog.Info("Fake judge started and listening on jobs.>")
	return nil
}

func (fj *FakeJudge) evaluate(job models.JudgeJobPayload) models.JudgeVerdictPayload {
	vp := models.JudgeVerdictPayload{
		SubmissionID:      job.SubmissionID,
		AttemptID:         job.AttemptID,
		Status:            models.StatusDone,
		Verdict:           models.VerdictAC,
		TotalTimeMS:       15,
		PeakMemoryKB:      4096,
		TotalInstructions: 850000,
		JudgeHost:         "fake-judge-local",
	}

	src := job.SourceCode

	// CE test
	if strings.Contains(src, "// CE") || strings.Contains(src, "syntax_error_here") {
		vp.Verdict = models.VerdictCE
		vp.CompileOutput = "sol.cpp: In function 'int main()': error: expected ';' before 'return'"
		return vp
	}

	// TLE test
	if strings.Contains(src, "// TLE") || strings.Contains(src, "for (int i = 0; i < n; ++i) { for (int j = i + 1; j < n; ++j)") {
		vp.Verdict = models.VerdictTLE
		vp.TotalTimeMS = job.TimeLimitMS + 200
		fTest := 1
		fGroup := "max-size"
		vp.FailedTest = &fTest
		vp.FailedGroup = &fGroup
		vp.TestResults = append(vp.TestResults, models.JudgeTestResultDetail{
			Ordinal:    1,
			GroupName:  "max-size",
			Verdict:    models.VerdictTLE,
			TimeMS:     job.TimeLimitMS + 200,
			MemoryKB:   4096,
			Diagnostic: "Time limit exceeded (> 1000ms)",
		})
		return vp
	}

	// WA test
	if strings.Contains(src, "// WA") || strings.Contains(src, "-1 -1") {
		vp.Verdict = models.VerdictWA
		fTest := 1
		fGroup := "sample"
		vp.FailedTest = &fTest
		vp.FailedGroup = &fGroup
		vp.TestResults = append(vp.TestResults, models.JudgeTestResultDetail{
			Ordinal:    1,
			GroupName:  "sample",
			Verdict:    models.VerdictWA,
			TimeMS:     8,
			MemoryKB:   2048,
			Diagnostic: "Wrong Answer: expected '0 1', got '-1 -1'",
		})
		return vp
	}

	// RE test
	if strings.Contains(src, "// RE") {
		vp.Verdict = models.VerdictRE
		fTest := 1
		vp.FailedTest = &fTest
		vp.TestResults = append(vp.TestResults, models.JudgeTestResultDetail{
			Ordinal:    1,
			GroupName:  "sample",
			Verdict:    models.VerdictRE,
			TimeMS:     4,
			MemoryKB:   2048,
			Diagnostic: "Runtime error: signal 11 (SIGSEGV)",
		})
		return vp
	}

	// COMPLEXITY_FAIL simulation (linear scan or query budget breach)
	if strings.Contains(src, "// COMPLEXITY_FAIL") || strings.Contains(src, "// LINEAR_SCAN_ON_BS") {
		vp.Verdict = models.VerdictAC
		for idx, tc := range job.TestCases {
			inst := int64(20000)
			diag := ""
			if strings.Contains(strings.ToLower(tc.GroupName), "max") || strings.Contains(strings.ToLower(tc.GroupName), "large") {
				inst = 5000000 // 250x scaling
				diag = "queries: 1000"
			}
			vp.TestResults = append(vp.TestResults, models.JudgeTestResultDetail{
				Ordinal:      idx + 1,
				GroupName:    tc.GroupName,
				Verdict:      models.VerdictAC,
				TimeMS:       25,
				MemoryKB:     4096,
				Instructions: inst,
				Diagnostic:   diag,
			})
		}
		return vp
	}

	// Default: Accepted (AC) for test cases
	for idx, tc := range job.TestCases {
		vp.TestResults = append(vp.TestResults, models.JudgeTestResultDetail{
			Ordinal:      idx + 1,
			GroupName:    tc.GroupName,
			Verdict:      models.VerdictAC,
			TimeMS:       12,
			MemoryKB:     3500,
			Instructions: 120000,
		})
	}
	return vp
}
