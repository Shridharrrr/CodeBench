package scoring

import (
	"time"

	"github.com/codebench/codebench/api/internal/models"
)

// Scorer calculates contest standings using a pure strategy interface
type Scorer interface {
	ComputeStandings(
		contest *models.Contest,
		problems []models.ContestProblem,
		participants []models.Participant,
		submissions []models.Submission,
		asOf time.Time,
		maskFrozen bool,
	) *models.Leaderboard
}

// GetScorer returns the appropriate Scorer implementation based on contest scoring strategy
func GetScorer(scoringStrategy string) Scorer {
	switch scoringStrategy {
	case "points":
		return NewPointsScorer()
	case "icpc":
		fallthrough
	default:
		return NewICPCScorer()
	}
}
