package practice

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

var problemLabels = []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"}

type Service struct {
	db *database.DB
}

func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

// GeneratePracticeSet creates a custom practice contest (Mode B) tailored to user criteria
func (s *Service) GeneratePracticeSet(
	ctx context.Context,
	userID *uuid.UUID,
	req models.PracticeGenerateRequest,
) (*models.PracticeGenerateResponse, error) {
	// Sanitize request
	count := req.Count
	if count <= 0 {
		count = 3
	}
	if count > 10 {
		count = 10
	}

	difficulty := strings.ToUpper(strings.TrimSpace(req.Difficulty))
	if difficulty == "" {
		difficulty = "ANY"
	}

	// 1. Determine excluded solved problems if requested and user is authenticated
	var excludeIDs []uuid.UUID
	if req.ExcludeSolved && userID != nil {
		solvedIDs, err := s.db.GetUserSolvedProblemVersionIDs(ctx, *userID)
		if err == nil {
			excludeIDs = solvedIDs
		}
	}

	// 2. Fetch eligible problem candidates
	candidates, err := s.db.GetPracticeEligibleProblems(ctx, difficulty, req.Tags, excludeIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to search practice problems: %w", err)
	}

	// If no problems found with exclusion, fallback to allow solved problems
	if len(candidates) < count && len(excludeIDs) > 0 {
		fallback, err := s.db.GetPracticeEligibleProblems(ctx, difficulty, req.Tags, nil)
		if err == nil && len(fallback) > len(candidates) {
			candidates = fallback
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no problems matching difficulty '%s' and tags found", difficulty)
	}

	// 3. Shuffle / Sample candidates
	var rng *rand.Rand
	if req.Seed != nil {
		rng = rand.New(rand.NewSource(*req.Seed))
	} else {
		rng = rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	shuffled := make([]database.PracticeCandidate, len(candidates))
	copy(shuffled, candidates)
	rng.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	selectCount := count
	if selectCount > len(shuffled) {
		selectCount = len(shuffled)
	}
	selected := shuffled[:selectCount]

	// 4. Construct Contest Problems
	now := time.Now().UTC()
	var duration time.Duration
	if req.DurationMinutes > 0 {
		duration = time.Duration(req.DurationMinutes) * time.Minute
	} else {
		// Untimed practice defaults to 30 days
		duration = 30 * 24 * time.Hour
	}

	contestID := uuid.New()
	titleDifficulty := difficulty
	if titleDifficulty == "ANY" {
		titleDifficulty = "Mixed"
	}
	contestTitle := fmt.Sprintf("Practice Session: %s (%d Problems)", titleDifficulty, selectCount)

	contest := &models.Contest{
		ID:        contestID,
		Title:     contestTitle,
		Mode:      "practice",
		StartsAt:  now,
		EndsAt:    now.Add(duration),
		Scoring:   "icpc",
		OwnerID:   userID,
		CreatedAt: now,
	}

	var contestProblems []models.ContestProblem
	var summaries []models.ContestProblemSummary

	for idx, cand := range selected {
		lbl := problemLabels[idx]
		contestProblems = append(contestProblems, models.ContestProblem{
			ProblemVersionID: cand.ProblemVersion.ID,
			Label:            lbl,
			Points:           100,
		})
		summaries = append(summaries, models.ContestProblemSummary{
			Label:      lbl,
			Points:     100,
			Title:      cand.ProblemVersion.Title,
			Slug:       cand.Slug,
			Difficulty: cand.ProblemVersion.Difficulty,
			Tags:       cand.ProblemVersion.Tags,
		})
	}

	// 5. Persist practice contest and problems
	if err := s.db.CreateContest(ctx, contest, contestProblems); err != nil {
		return nil, fmt.Errorf("failed to create practice contest: %w", err)
	}

	// 6. Auto-join user
	if userID != nil {
		_ = s.db.JoinContest(ctx, contestID, *userID)
	}

	return &models.PracticeGenerateResponse{
		ContestID:       contestID,
		Title:           contestTitle,
		Mode:            "practice",
		StartsAt:        contest.StartsAt,
		EndsAt:          contest.EndsAt,
		DurationMinutes: req.DurationMinutes,
		ProblemCount:    selectCount,
		Problems:        summaries,
	}, nil
}

// ListUserPracticeHistory returns the practice contests created for a user
func (s *Service) ListUserPracticeHistory(ctx context.Context, userID uuid.UUID) ([]models.Contest, error) {
	return s.db.GetUserPracticeContests(ctx, userID)
}
