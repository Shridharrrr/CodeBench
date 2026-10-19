package rejudge

import (
	"context"
	"testing"

	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
)

func TestRejudgeScopeValidation(t *testing.T) {
	broker := events.NewBroker()
	svc := NewService(nil, broker)

	ctx := context.Background()
	req := models.RejudgeBatchRequest{
		ScopeType: models.RejudgeScopeSubmission,
		ScopeID:   "not-a-valid-uuid",
	}

	_, err := svc.TriggerRejudge(ctx, req, nil)
	if err == nil {
		t.Errorf("Expected error for invalid scope UUID, got nil")
	}
}
