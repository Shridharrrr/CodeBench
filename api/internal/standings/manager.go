package standings

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/internal/scoring"
	"github.com/google/uuid"
)

type StandingsManager struct {
	db         *database.DB
	broker     *events.Broker
	mu         sync.RWMutex
	cache      map[uuid.UUID]*models.Leaderboard // Public masked cache
	adminCache map[uuid.UUID]*models.Leaderboard // Admin unmasked cache
}

func NewManager(db *database.DB, broker *events.Broker) *StandingsManager {
	return &StandingsManager{
		db:         db,
		broker:     broker,
		cache:      make(map[uuid.UUID]*models.Leaderboard),
		adminCache: make(map[uuid.UUID]*models.Leaderboard),
	}
}

// SetCache explicitly updates the cached public and admin leaderboards (useful for testing or direct seeding)
func (m *StandingsManager) SetCache(contestID uuid.UUID, publicBoard, adminBoard *models.Leaderboard) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache[contestID] = publicBoard
	m.adminCache[contestID] = adminBoard
}

// Invalidate clears the cached standings for a contest
func (m *StandingsManager) Invalidate(contestID uuid.UUID) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.cache, contestID)
	delete(m.adminCache, contestID)
}

// GetLeaderboard returns the current leaderboard for a contest, respecting scoreboard freeze for non-admins
func (m *StandingsManager) GetLeaderboard(ctx context.Context, contestID uuid.UUID, isAdmin bool) (*models.Leaderboard, error) {
	m.mu.RLock()
	var cached *models.Leaderboard
	if isAdmin {
		cached = m.adminCache[contestID]
	} else {
		cached = m.cache[contestID]
	}
	m.mu.RUnlock()

	if cached != nil {
		return cached, nil
	}

	// Cache miss: compute from PostgreSQL (source of truth)
	return m.RecomputeAndCache(ctx, contestID, isAdmin)
}

// RecomputeAndCache re-evaluates standings from PostgreSQL and updates in-memory cache
func (m *StandingsManager) RecomputeAndCache(ctx context.Context, contestID uuid.UUID, isAdmin bool) (*models.Leaderboard, error) {
	if m.db == nil {
		return nil, fmt.Errorf("database client is nil")
	}

	contest, err := m.db.GetContest(ctx, contestID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch contest: %w", err)
	}

	problems, err := m.db.GetContestProblems(ctx, contestID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch contest problems: %w", err)
	}

	participants, err := m.db.GetContestParticipants(ctx, contestID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch contest participants: %w", err)
	}

	submissions, err := m.db.GetContestSubmissions(ctx, contestID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch contest submissions: %w", err)
	}

	now := time.Now().UTC()
	scorer := scoring.GetScorer(contest.Scoring)

	publicBoard := scorer.ComputeStandings(contest, problems, participants, submissions, now, true)
	adminBoard := scorer.ComputeStandings(contest, problems, participants, submissions, now, false)

	// Incorporate manual admin score adjustments (penalties or bonuses)
	adjustments, err := m.db.GetScoreAdjustmentsForContest(ctx, contestID)
	if err == nil && len(adjustments) > 0 {
		applyAdjustments(publicBoard, adjustments)
		applyAdjustments(adminBoard, adjustments)
	}

	m.mu.Lock()
	m.cache[contestID] = publicBoard
	m.adminCache[contestID] = adminBoard
	m.mu.Unlock()

	// Broadcast live leaderboard update event to SSE subscribers
	if m.broker != nil {
		m.broker.PublishSubmissionStatus(
			"contest_"+contestID.String(),
			models.StatusDone,
			models.VerdictAC,
			map[string]any{
				"contest_id": contestID,
				"is_frozen":  publicBoard.IsFrozen,
				"top_rows":   publicBoard.Rows,
			},
		)
	}

	if isAdmin {
		return adminBoard, nil
	}
	return publicBoard, nil
}

func applyAdjustments(board *models.Leaderboard, adjustments []models.ScoreAdjustment) {
	if board == nil || len(board.Rows) == 0 {
		return
	}
	userAdj := make(map[uuid.UUID]int)
	for _, adj := range adjustments {
		if adj.UserID != nil {
			userAdj[*adj.UserID] += adj.Points
		}
	}
	for i := range board.Rows {
		uid := board.Rows[i].UserID
		if pts, ok := userAdj[uid]; ok {
			board.Rows[i].Score += pts
			board.Rows[i].Adjustments += pts
		}
	}
	// Re-sort rows by Score DESC, Penalty ASC
	sort.Slice(board.Rows, func(i, j int) bool {
		if board.Rows[i].Score != board.Rows[j].Score {
			return board.Rows[i].Score > board.Rows[j].Score
		}
		return board.Rows[i].Penalty < board.Rows[j].Penalty
	})
	for i := range board.Rows {
		board.Rows[i].Rank = i + 1
	}
}

// RebuildAll pre-warms in-memory standings from PostgreSQL on startup
func (m *StandingsManager) RebuildAll(ctx context.Context) error {
	if m.db == nil {
		return fmt.Errorf("database client is nil")
	}

	contests, err := m.db.ListContests(ctx, "")
	if err != nil {
		return err
	}

	for _, c := range contests {
		if _, err := m.RecomputeAndCache(ctx, c.ID, false); err != nil {
			slog.Warn("Failed to precompute standings for contest", "contest_id", c.ID, "error", err)
		}
	}
	return nil
}
