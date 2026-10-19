package scoring

import (
	"sort"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

type PointsScorer struct {
	PenaltyMinutesPerWrongAttempt int64
}

func NewPointsScorer() *PointsScorer {
	return &PointsScorer{
		PenaltyMinutesPerWrongAttempt: 10,
	}
}

func (s *PointsScorer) ComputeStandings(
	contest *models.Contest,
	problems []models.ContestProblem,
	participants []models.Participant,
	submissions []models.Submission,
	asOf time.Time,
	maskFrozen bool,
) *models.Leaderboard {
	isContestFrozen := false
	if contest.FreezeAt != nil && !asOf.Before(*contest.FreezeAt) && asOf.Before(contest.EndsAt) {
		isContestFrozen = true
	}

	probMap := make(map[uuid.UUID]models.ContestProblem)
	for _, p := range problems {
		probMap[p.ProblemVersionID] = p
	}

	rowsMap := make(map[uuid.UUID]*models.LeaderboardRow)

	for _, part := range participants {
		name := part.UserName
		if name == "" {
			name = part.UserEmail
		}
		if name == "" {
			name = "Participant " + part.UserID.String()[:8]
		}

		pCells := make(map[string]models.ProblemCell)
		for _, p := range problems {
			pCells[p.Label] = models.ProblemCell{
				Label:  p.Label,
				Points: p.Points,
			}
		}

		rowsMap[part.UserID] = &models.LeaderboardRow{
			UserID:   part.UserID,
			UserName: name,
			Score:    0,
			Penalty:  0,
			Problems: pCells,
		}
	}

	for _, sub := range submissions {
		if sub.UserID == nil {
			continue
		}
		row, exists := rowsMap[*sub.UserID]
		if !exists {
			row = &models.LeaderboardRow{
				UserID:   *sub.UserID,
				UserName: "User " + sub.UserID.String()[:8],
				Problems: make(map[string]models.ProblemCell),
			}
			for _, p := range problems {
				row.Problems[p.Label] = models.ProblemCell{
					Label:  p.Label,
					Points: p.Points,
				}
			}
			rowsMap[*sub.UserID] = row
		}

		cp, ok := probMap[sub.ProblemVersionID]
		if !ok {
			continue
		}

		cell := row.Problems[cp.Label]
		if cell.Solved {
			continue
		}

		isFrozenSub := false
		if maskFrozen && contest.FreezeAt != nil && !sub.CreatedAt.Before(*contest.FreezeAt) {
			isFrozenSub = true
		}

		var subMinutes int64
		if sub.CreatedAt.After(contest.StartsAt) {
			subMinutes = int64(sub.CreatedAt.Sub(contest.StartsAt).Minutes())
		}

		if isFrozenSub {
			cell.AttemptCount++
			cell.IsFrozen = true
			row.Problems[cp.Label] = cell
			continue
		}

		if sub.Verdict == models.VerdictAC {
			cell.Solved = true
			cell.AttemptCount++
			cell.SolvedTimeMinutes = subMinutes
			cell.Points = cp.Points

			probPenalty := subMinutes + int64(cell.AttemptCount-1)*s.PenaltyMinutesPerWrongAttempt
			row.Score += cp.Points
			row.Penalty += probPenalty

			if row.LastACTime == nil || sub.CreatedAt.After(*row.LastACTime) {
				t := sub.CreatedAt
				row.LastACTime = &t
			}
		} else if sub.Verdict != models.VerdictCE && sub.Verdict != models.VerdictPending {
			cell.AttemptCount++
		}

		row.Problems[cp.Label] = cell
	}

	rows := make([]models.LeaderboardRow, 0, len(rowsMap))
	for _, r := range rowsMap {
		rows = append(rows, *r)
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Score != rows[j].Score {
			return rows[i].Score > rows[j].Score
		}
		if rows[i].Penalty != rows[j].Penalty {
			return rows[i].Penalty < rows[j].Penalty
		}
		if rows[i].LastACTime != nil && rows[j].LastACTime != nil {
			if !rows[i].LastACTime.Equal(*rows[j].LastACTime) {
				return rows[i].LastACTime.Before(*rows[j].LastACTime)
			}
		} else if rows[i].LastACTime != nil {
			return true
		} else if rows[j].LastACTime != nil {
			return false
		}
		return strings.ToLower(rows[i].UserName) < strings.ToLower(rows[j].UserName)
	})

	currentRank := 1
	for i := range rows {
		if i > 0 {
			prev := rows[i-1]
			curr := rows[i]
			isTie := prev.Score == curr.Score &&
				prev.Penalty == curr.Penalty &&
				((prev.LastACTime == nil && curr.LastACTime == nil) ||
					(prev.LastACTime != nil && curr.LastACTime != nil && prev.LastACTime.Equal(*curr.LastACTime)))
			if !isTie {
				currentRank = i + 1
			}
		}
		rows[i].Rank = currentRank
	}

	return &models.Leaderboard{
		ContestID: contest.ID,
		IsFrozen:  isContestFrozen && maskFrozen,
		UpdatedAt: asOf,
		Rows:      rows,
	}
}
