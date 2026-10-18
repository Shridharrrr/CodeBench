package verdict

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/nats-io/nats.go"
)

type Consumer struct {
	db       *database.DB
	queueMgr *queue.NATSManager
	broker   *events.Broker
}

func NewConsumer(db *database.DB, queueMgr *queue.NATSManager, broker *events.Broker) *Consumer {
	return &Consumer{
		db:       db,
		queueMgr: queueMgr,
		broker:   broker,
	}
}

func (c *Consumer) Start(ctx context.Context) error {
	js := c.queueMgr.JetStream()

	// Create durable pull or push subscription for verdicts
	sub, err := js.Subscribe("verdicts.submissions", func(msg *nats.Msg) {
		var vp models.JudgeVerdictPayload
		if err := json.Unmarshal(msg.Data, &vp); err != nil {
			slog.Error("Failed to unmarshal judge verdict payload", "error", err)
			_ = msg.Term()
			return
		}

		slog.Info("Received judge verdict from NATS",
			"submission_id", vp.SubmissionID,
			"verdict", vp.Verdict,
			"time_ms", vp.TotalTimeMS,
			"judge_host", vp.JudgeHost,
		)

		// Persist idempotently
		if err := c.db.SaveVerdictIdempotent(ctx, &vp); err != nil {
			slog.Error("Failed to save verdict idempotently", "submission_id", vp.SubmissionID, "error", err)
			_ = msg.NakWithDelay(1 * time.Second)
			return
		}

		// Notify live SSE subscribers
		c.broker.PublishSubmissionStatus(vp.SubmissionID, vp.Status, vp.Verdict, vp)

		// Acknowledge JetStream message
		if err := msg.Ack(); err != nil {
			slog.Warn("Failed to ack verdict message", "submission_id", vp.SubmissionID, "error", err)
		}
	}, nats.Durable("api-verdict-consumer"), nats.ManualAck())

	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		_ = sub.Unsubscribe()
	}()

	slog.Info("Verdict consumer listening on verdicts.submissions")
	return nil
}
