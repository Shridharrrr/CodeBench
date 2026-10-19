package sweeper

import (
	"context"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/events"
)

func TestSweeperInitializationDefaults(t *testing.T) {
	broker := events.NewBroker()
	sw := NewSweeper(nil, broker, 0, 0)

	if sw.staleThreshold != 5*time.Minute {
		t.Errorf("Expected default stale threshold of 5m, got %v", sw.staleThreshold)
	}
	if sw.interval != 30*time.Second {
		t.Errorf("Expected default interval of 30s, got %v", sw.interval)
	}

	// Verify non-blocking context cancellation on start
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	sw.Start(ctx)
}
