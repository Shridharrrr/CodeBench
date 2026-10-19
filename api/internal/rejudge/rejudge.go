package rejudge

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

type Service struct {
	db     *database.DB
	broker *events.Broker
}

func NewService(db *database.DB, broker *events.Broker) *Service {
	return &Service{
		db:     db,
		broker: broker,
	}
}

// TriggerRejudge validates scope, creates a rejudge batch, and requeues all scoped submissions
func (s *Service) TriggerRejudge(ctx context.Context, req models.RejudgeBatchRequest, requestedBy *uuid.UUID) (*models.RejudgeBatchResponse, error) {
	scopeUUID, err := uuid.Parse(req.ScopeID)
	if err != nil {
		return nil, fmt.Errorf("invalid scope id UUID: %w", err)
	}

	scope := models.RejudgeScope{
		Type: req.ScopeType,
		ID:   scopeUUID,
	}

	// 1. Fetch matching submissions
	subs, err := s.db.GetSubmissionsForRejudge(ctx, scope)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve submissions for rejudge: %w", err)
	}

	// 2. Insert rejudge batch record
	batch, err := s.db.CreateRejudgeBatch(ctx, scope, requestedBy)
	if err != nil {
		return nil, fmt.Errorf("failed to create rejudge batch record: %w", err)
	}

	slog.Info("Initiating rejudge batch", "batch_id", batch.ID, "scope_type", scope.Type, "scope_id", scope.ID, "submissions_count", len(subs))

	// 3. Requeue each submission
	queuedCount := 0
	for _, sub := range subs {
		// Resolve problem version and test cases
		ver, err := s.db.GetProblemVersionByID(ctx, sub.ProblemVersionID)
		if err != nil {
			slog.Warn("Skipping submission in rejudge: problem version not found", "submission_id", sub.ID, "version_id", sub.ProblemVersionID, "error", err)
			continue
		}

		testCases, err := s.db.GetTestCasesByVersionID(ctx, ver.ID)
		if err != nil {
			slog.Warn("Skipping submission in rejudge: test cases not found", "submission_id", sub.ID, "version_id", ver.ID, "error", err)
			continue
		}

		attemptID := uuid.New()
		var compPolicyStr string
		if len(ver.ComplexityPolicy) > 0 {
			b, _ := json.Marshal(ver.ComplexityPolicy)
			compPolicyStr = string(b)
		}

		jobPayload := models.JudgeJobPayload{
			SubmissionID:     sub.ID.String(),
			AttemptID:        attemptID.String(),
			Language:         sub.Language,
			SourceCode:       sub.Source,
			TimeLimitMS:      int64(ver.TimeLimitMS),
			MemoryLimitKB:    int64(ver.MemoryMB * 1024),
			CheckerType:      ver.CheckerType,
			ComplexityPolicy: compPolicyStr,
			TestCases:        testCases,
		}

		if err := s.db.RequeueSubmissionForRejudge(ctx, sub.ID, jobPayload); err != nil {
			slog.Error("Failed to requeue submission for rejudge", "submission_id", sub.ID, "error", err)
			continue
		}

		// Broadcast QUEUED status to SSE listeners
		if s.broker != nil {
			s.broker.PublishSubmissionStatus(sub.ID.String(), models.StatusQueued, models.VerdictPending, nil)
		}

		queuedCount++
	}

	return &models.RejudgeBatchResponse{
		BatchID:     batch.ID.String(),
		ScopeType:   scope.Type,
		ScopeID:     scope.ID.String(),
		QueuedCount: queuedCount,
		Status:      "processing",
	}, nil
}

// GetStatus returns the current status and execution tally of a batch
func (s *Service) GetStatus(ctx context.Context, batchID uuid.UUID) (*models.RejudgeBatchStatus, error) {
	return s.db.GetRejudgeBatchStatus(ctx, batchID)
}
