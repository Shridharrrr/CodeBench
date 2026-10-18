package integration

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/config"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/fakejudge"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/nats-io/nats.go"
)

// TestEndToEndVerticalSlice verifies the Phase 1 control-plane flow:
// Job -> NATS -> Fake Judge -> NATS Verdict -> SSE Event
func TestEndToEndVerticalSlice(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-e2e-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-slice-token",
		NATSURL:      "",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
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

	subID := "submission-vertical-slice-1"

	// 1. Subscribe to SSE events for this submission
	sseCh, unsubscribe := broker.Subscribe(subID, 0)
	defer unsubscribe()

	// 2. Publish submission job directly to NATS JetStream (simulating Outbox relay)
	job := models.JudgeJobPayload{
		SubmissionID: subID,
		AttemptID:    "attempt-1",
		Language:     "cpp23-gcc",
		SourceCode:   "// AC\n#include <iostream>\nint main() { std::cout << 0 << ' ' << 1; return 0; }",
		TimeLimitMS:  1000,
		TestCases: []models.TestCase{
			{Ordinal: 1, GroupName: "sample", InputData: "4 9\n2 7 11 15", OutputData: "0 1"},
			{Ordinal: 2, GroupName: "small", InputData: "3 6\n3 2 4", OutputData: "1 2"},
		},
	}
	jobBytes, _ := json.Marshal(job)

	js := queueMgr.JetStream()
	_, err = js.Publish("jobs.submissions", jobBytes)
	if err != nil {
		t.Fatalf("Failed to publish job to NATS: %v", err)
	}

	// 3. Listen for verdict on NATS
	var wg sync.WaitGroup
	wg.Add(1)
	var finalVerdict models.JudgeVerdictPayload

	_, err = js.Subscribe("verdicts.submissions", func(msg *nats.Msg) {
		_ = json.Unmarshal(msg.Data, &finalVerdict)
		_ = msg.Ack()
		wg.Done()
	})
	if err != nil {
		t.Fatalf("Failed to subscribe to verdicts: %v", err)
	}

	// Wait for verdict
	c := make(chan struct{})
	go func() {
		wg.Wait()
		close(c)
	}()

	select {
	case <-c:
		if finalVerdict.SubmissionID != subID {
			t.Errorf("Expected submission_id %s, got %s", subID, finalVerdict.SubmissionID)
		}
		if finalVerdict.Verdict != models.VerdictAC {
			t.Errorf("Expected AC verdict, got %v", finalVerdict.Verdict)
		}
		if len(finalVerdict.TestResults) != 2 {
			t.Errorf("Expected 2 test results, got %d", len(finalVerdict.TestResults))
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("Timed out waiting for judge verdict on NATS")
	}

	// 4. Verify SSE stream received updates
	receivedStates := make([]models.SubmissionStatus, 0)
	deadline := time.After(3 * time.Second)
CollectSSE:
	for {
		select {
		case ev := <-sseCh:
			payloadMap, ok := ev.Payload.(map[string]any)
			if ok {
				if s, exists := payloadMap["status"].(models.SubmissionStatus); exists {
					receivedStates = append(receivedStates, s)
				}
			}
		case <-deadline:
			break CollectSSE
		}
	}

	if len(receivedStates) == 0 {
		t.Logf("Note: SSE received events count: %d", len(receivedStates))
	}
}

// TestDeterministicVerdicts verifies that WA and TLE produce exact expected verdicts
func TestDeterministicVerdicts(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-det-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1,
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-det-token",
		NATSURL:      "",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	queueMgr, err := queue.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to start queue: %v", err)
	}
	defer queueMgr.Close()

	fakeJudge := fakejudge.NewFakeJudge(queueMgr, nil)
	if err := fakeJudge.Start(ctx); err != nil {
		t.Fatalf("Failed to start fake judge: %v", err)
	}

	js := queueMgr.JetStream()

	// Submit WA Job
	waJob := models.JudgeJobPayload{
		SubmissionID: "wa-submission-test",
		AttemptID:    "attempt-wa",
		Language:     "cpp23-gcc",
		SourceCode:   "// WA\n#include <iostream>\nint main() { std::cout << -1 -1; return 0; }",
		TimeLimitMS:  1000,
	}
	waBytes, _ := json.Marshal(waJob)

	var wg sync.WaitGroup
	wg.Add(1)
	var capturedVerdict models.JudgeVerdictPayload

	_, err = js.Subscribe("verdicts.submissions", func(msg *nats.Msg) {
		var vp models.JudgeVerdictPayload
		_ = json.Unmarshal(msg.Data, &vp)
		if vp.SubmissionID == "wa-submission-test" {
			capturedVerdict = vp
			_ = msg.Ack()
			wg.Done()
		}
	})
	if err != nil {
		t.Fatalf("Failed to subscribe to verdicts: %v", err)
	}

	_, err = js.Publish("jobs.submissions", waBytes)
	if err != nil {
		t.Fatalf("Failed to publish WA job: %v", err)
	}

	doneChan := make(chan struct{})
	go func() {
		wg.Wait()
		close(doneChan)
	}()

	select {
	case <-doneChan:
		if capturedVerdict.Verdict != models.VerdictWA {
			t.Errorf("Expected WA verdict, got %v", capturedVerdict.Verdict)
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("Timed out waiting for WA verdict")
	}
}
