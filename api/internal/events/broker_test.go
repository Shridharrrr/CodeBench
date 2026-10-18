package events

import (
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/models"
)

func TestSSEBroker(t *testing.T) {
	broker := NewBroker()

	subID := "sub-test-123"

	// Subscribe
	ch, unsubscribe := broker.Subscribe(subID, 0)
	defer unsubscribe()

	// Publish QUEUED event
	broker.PublishSubmissionStatus(subID, models.StatusQueued, models.VerdictPending, nil)

	select {
	case ev := <-ch:
		if ev.TargetID != subID {
			t.Errorf("Expected targetID %s, got %s", subID, ev.TargetID)
		}
		if ev.ID != 1 {
			t.Errorf("Expected event ID 1, got %d", ev.ID)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("Timed out waiting for event")
	}

	// Publish DONE AC event
	broker.PublishSubmissionStatus(subID, models.StatusDone, models.VerdictAC, map[string]any{"time_ms": 15})

	select {
	case ev := <-ch:
		if ev.ID != 2 {
			t.Errorf("Expected event ID 2, got %d", ev.ID)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("Timed out waiting for event 2")
	}

	// Test Replay with Last-Event-ID = 1
	replayCh, replayUnsub := broker.Subscribe(subID, 1)
	defer replayUnsub()

	select {
	case ev := <-replayCh:
		if ev.ID != 2 {
			t.Errorf("Expected replayed event ID 2, got %d", ev.ID)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("Timed out waiting for replayed event")
	}
}
