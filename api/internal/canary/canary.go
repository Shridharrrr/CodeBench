package canary

import (
	"context"
	"log/slog"
	"math"
	"sync"
	"time"
)

type Canary struct {
	mu           sync.RWMutex
	baseline     time.Duration
	lastDuration time.Duration
	driftRatio   float64
	healthy      bool
	interval     time.Duration
	tolerance    float64
}

func NewCanary(interval time.Duration, tolerance float64) *Canary {
	if interval == 0 {
		interval = 60 * time.Second
	}
	if tolerance <= 0 {
		tolerance = 0.15 // 15% tolerance
	}

	c := &Canary{
		interval:  interval,
		tolerance: tolerance,
		healthy:   true,
	}

	// Calibrate baseline on initial startup
	c.calibrate()
	return c
}

func (c *Canary) calibrate() {
	// Warm up
	for i := 0; i < 2; i++ {
		c.executeDeterministicWorkload()
	}

	// Run 5 passes and compute median
	samples := make([]time.Duration, 5)
	for i := 0; i < 5; i++ {
		samples[i] = c.executeDeterministicWorkload()
	}
	for i := 0; i < len(samples); i++ {
		for j := i + 1; j < len(samples); j++ {
			if samples[i] > samples[j] {
				samples[i], samples[j] = samples[j], samples[i]
			}
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	c.baseline = samples[2] // Median of 5
	c.lastDuration = c.baseline
	c.driftRatio = 0.0
	c.healthy = true
	slog.Info("Timing canary baseline calibrated", "baseline_ms", float64(c.baseline.Microseconds())/1000.0)
}

func (c *Canary) Start(ctx context.Context) {
	slog.Info("Starting timing canary scheduler...", "interval", c.interval)
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Timing canary scheduler stopping...")
			return
		case <-ticker.C:
			c.RunOnce()
		}
	}
}

// RunOnce executes calibration runs and takes the median to filter out OS scheduler spikes
func (c *Canary) RunOnce() (time.Duration, float64, bool) {
	s := make([]time.Duration, 3)
	for i := 0; i < 3; i++ {
		s[i] = c.executeDeterministicWorkload()
	}
	if s[0] > s[1] {
		s[0], s[1] = s[1], s[0]
	}
	if s[1] > s[2] {
		s[1], s[2] = s[2], s[1]
	}
	if s[0] > s[1] {
		s[0], s[1] = s[1], s[0]
	}
	dur := s[1] // Median

	c.mu.Lock()
	defer c.mu.Unlock()

	c.lastDuration = dur
	if c.baseline > 0 {
		diff := math.Abs(float64(dur - c.baseline))
		c.driftRatio = diff / float64(c.baseline)
		c.healthy = c.driftRatio <= c.tolerance
	} else {
		c.baseline = dur
		c.driftRatio = 0.0
		c.healthy = true
	}

	if !c.healthy {
		slog.Warn("Timing canary detected significant CPU timing drift!",
			"drift_ratio", c.driftRatio,
			"tolerance", c.tolerance,
			"measured_ms", float64(dur.Microseconds())/1000.0,
			"baseline_ms", float64(c.baseline.Microseconds())/1000.0,
		)
	} else {
		slog.Debug("Timing canary check passed",
			"drift_ratio", c.driftRatio,
			"measured_ms", float64(dur.Microseconds())/1000.0,
		)
	}

	return c.lastDuration, c.driftRatio, c.healthy
}

func (c *Canary) LastDuration() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastDuration
}

func (c *Canary) BaselineDuration() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.baseline
}

func (c *Canary) DriftRatio() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.driftRatio
}

func (c *Canary) IsHealthy() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.healthy
}

// executeDeterministicWorkload runs a CPU-bound deterministic mathematical computation
func (c *Canary) executeDeterministicWorkload() time.Duration {
	start := time.Now()

	// Deterministic workload designed to measure CPU-bound execution speed
	var acc uint64 = 14695981039346656037
	for i := uint64(0); i < 20000000; i++ {
		acc ^= i * 1099511628211
		acc = (acc << 13) | (acc >> 51)
		acc += (acc ^ (acc >> 7))
	}
	_ = acc

	return time.Since(start)
}
