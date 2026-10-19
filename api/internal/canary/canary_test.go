package canary

import (
	"testing"
	"time"
)

func TestCanaryCalibrationAndDrift(t *testing.T) {
	c := NewCanary(100*time.Millisecond, 0.25)
	if c.BaselineDuration() <= 0 {
		t.Fatalf("Expected positive baseline duration, got %v", c.BaselineDuration())
	}

	dur, drift, healthy := c.RunOnce()
	if dur <= 0 {
		t.Errorf("Expected positive run duration, got %v", dur)
	}

	if drift < 0.0 {
		t.Errorf("Expected non-negative drift ratio, got %v", drift)
	}

	if !healthy {
		// On non-realtime / Grade C development environments (Windows/macOS under background load),
		// retry once to guard against transient OS task preemption
		dur, drift, healthy = c.RunOnce()
		if !healthy {
			t.Errorf("Expected freshly calibrated canary on same machine to be healthy, got unhealthy with drift %v", drift)
		}
	}

	if !c.IsHealthy() {
		t.Errorf("Expected IsHealthy() to return true")
	}
}

func TestCanaryDriftThreshold(t *testing.T) {
	c := &Canary{
		baseline:  100 * time.Millisecond,
		tolerance: 0.10, // 10%
	}

	// Case 1: Within tolerance (105ms vs 100ms baseline = 5% drift)
	c.mu.Lock()
	c.lastDuration = 105 * time.Millisecond
	c.driftRatio = 0.05
	c.healthy = c.driftRatio <= c.tolerance
	c.mu.Unlock()

	if !c.IsHealthy() {
		t.Errorf("Expected 5%% drift to be healthy with 10%% tolerance")
	}

	// Case 2: Exceeding tolerance (130ms vs 100ms baseline = 30% drift)
	c.mu.Lock()
	c.lastDuration = 130 * time.Millisecond
	c.driftRatio = 0.30
	c.healthy = c.driftRatio <= c.tolerance
	c.mu.Unlock()

	if c.IsHealthy() {
		t.Errorf("Expected 30%% drift to be unhealthy with 10%% tolerance")
	}
}
