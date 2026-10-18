package outbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/queue"
)

type Relay struct {
	db       *database.DB
	queueMgr *queue.NATSManager
	interval time.Duration
}

func NewRelay(db *database.DB, queueMgr *queue.NATSManager, interval time.Duration) *Relay {
	if interval == 0 {
		interval = 50 * time.Millisecond
	}
	return &Relay{
		db:       db,
		queueMgr: queueMgr,
		interval: interval,
	}
}

func (r *Relay) Start(ctx context.Context) {
	slog.Info("Starting Transactional Outbox Relay...", "interval", r.interval)
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Transactional Outbox Relay stopping...")
			return
		case <-ticker.C:
			r.processOutbox(ctx)
		}
	}
}

func (r *Relay) processOutbox(ctx context.Context) {
	entries, err := r.db.FetchUnpublishedOutbox(ctx, 50)
	if err != nil {
		slog.Error("Failed to fetch unpublished outbox rows", "error", err)
		return
	}

	if len(entries) == 0 {
		return
	}

	js := r.queueMgr.JetStream()
	for _, entry := range entries {
		data, err := json.Marshal(entry.Payload)
		if err != nil {
			slog.Error("Failed to marshal outbox payload", "id", entry.ID, "error", err)
			continue
		}

		// Publish to NATS JetStream
		_, err = js.Publish(entry.Subject, data)
		if err != nil {
			slog.Warn("Failed to publish outbox entry to NATS, will retry", "id", entry.ID, "subject", entry.Subject, "error", err)
			return
		}

		// Mark published in database
		if err := r.db.MarkOutboxPublished(ctx, entry.ID); err != nil {
			slog.Error("Failed to mark outbox entry published in DB", "id", entry.ID, "error", err)
			return
		}

		slog.Debug("Outbox entry relayed to NATS", "id", entry.ID, "subject", entry.Subject)
	}
}
