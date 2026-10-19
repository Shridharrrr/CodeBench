package verdict

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/codebench/codebench/api/internal/complexity"
	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/codebench/codebench/api/internal/standings"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

type Consumer struct {
	db           *database.DB
	queueMgr     *queue.NATSManager
	broker       *events.Broker
	standingsMgr *standings.StandingsManager
}

func NewConsumer(db *database.DB, queueMgr *queue.NATSManager, broker *events.Broker, standingsMgr *standings.StandingsManager) *Consumer {
	return &Consumer{
		db:           db,
		queueMgr:     queueMgr,
		broker:       broker,
		standingsMgr: standingsMgr,
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

		// Complexity Enforcement Gate (Phase 6)
		if subUUID, err := uuid.Parse(vp.SubmissionID); err == nil {
			if sub, err := c.db.GetSubmission(ctx, subUUID); err == nil && sub != nil {
				if pv, err := c.db.GetProblemVersionByID(ctx, sub.ProblemVersionID); err == nil && pv != nil && pv.ComplexityPolicy != nil {
					var policy models.ComplexityPolicy
					compBytes, _ := json.Marshal(pv.ComplexityPolicy)
					if err := json.Unmarshal(compBytes, &policy); err == nil {
						evaluator := complexity.NewEvaluator()
						newVerdict, report := evaluator.Evaluate(&policy, vp.TestResults, vp.Verdict)
						vp.Verdict = newVerdict
						if report != nil {
							var repMap map[string]any
							rBytes, _ := json.Marshal(report)
							_ = json.Unmarshal(rBytes, &repMap)
							vp.ComplexityReport = repMap
						}
					}
				}
			}
		}

		// Persist idempotently
		if err := c.db.SaveVerdictIdempotent(ctx, &vp); err != nil {
			slog.Error("Failed to save verdict idempotently", "submission_id", vp.SubmissionID, "error", err)
			_ = msg.NakWithDelay(1 * time.Second)
			return
		}

		// Notify live SSE subscribers
		c.broker.PublishSubmissionStatus(vp.SubmissionID, vp.Status, vp.Verdict, vp)

		// If submission belongs to a contest, trigger in-memory standings recomputation
		if c.standingsMgr != nil {
			if subUUID, err := uuid.Parse(vp.SubmissionID); err == nil {
				if sub, err := c.db.GetSubmission(ctx, subUUID); err == nil && sub.ContestID != nil {
					go func(cid uuid.UUID) {
						_, _ = c.standingsMgr.RecomputeAndCache(context.Background(), cid, false)
					}(*sub.ContestID)
				}
			}
		}

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
