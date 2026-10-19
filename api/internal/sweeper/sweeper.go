package sweeper

import (
	"context"
	"log/slog"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
)

type Sweeper struct {
	db             *database.DB
	broker         *events.Broker
	staleThreshold time.Duration
	interval       time.Duration
}

func NewSweeper(db *database.DB, broker *events.Broker, staleThreshold, interval time.Duration) *Sweeper {
	if staleThreshold == 0 {
		staleThreshold = 5 * time.Minute
	}
	if interval == 0 {
		interval = 30 * time.Second
	}
	return &Sweeper{
		db:             db,
		broker:         broker,
		staleThreshold: staleThreshold,
		interval:       interval,
	}
}

func (s *Sweeper) Start(ctx context.Context) {
	slog.Info("Starting Stale-Job Sweeper...", "stale_threshold", s.staleThreshold, "interval", s.interval)
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Stale-Job Sweeper stopping...")
			return
		case <-ticker.C:
			_, _ = s.SweepOnce(ctx)
		}
	}
}

// SweepOnce detects and recovers stale jobs in a single sweep cycle
func (s *Sweeper) SweepOnce(ctx context.Context) (int, error) {
	staleSubs, err := s.db.FetchStaleSubmissions(ctx, s.staleThreshold, 50)
	if err != nil {
		slog.Error("Sweeper failed to fetch stale submissions", "error", err)
		return 0, err
	}

	if len(staleSubs) == 0 {
		return 0, nil
	}

	recovered := 0
	for _, sub := range staleSubs {
		slog.Warn("Stale submission lease expired, marking terminal SE",
			"submission_id", sub.ID,
			"status", sub.Status,
			"created_at", sub.CreatedAt,
		)

		if err := s.db.MarkSubmissionSystemError(ctx, sub.ID, "stale_lease_timeout"); err != nil {
			slog.Error("Failed to mark stale submission as system error", "submission_id", sub.ID, "error", err)
			continue
		}

		if s.broker != nil {
			s.broker.PublishSubmissionStatus(sub.ID.String(), models.StatusDone, models.VerdictSE, map[string]any{
				"error": "execution lease expired (timeout or worker crash)",
			})
		}
		recovered++
	}

	slog.Info("Stale-job sweep cycle complete", "recovered_count", recovered)
	return recovered, nil
}
