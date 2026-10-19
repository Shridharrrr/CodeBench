package scoring

import (
	"sort"
	"strings"
	"time"

	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

type ICPCScorer struct {
	PenaltyMinutesPerWrongAttempt int64
}

func NewICPCScorer() *ICPCScorer {
	return &ICPCScorer{
		PenaltyMinutesPerWrongAttempt: 20,
	}
}

func (s *ICPCScorer) ComputeStandings(
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

	// Map problem_version_id -> ContestProblem
	probMap := make(map[uuid.UUID]models.ContestProblem)
	for _, p := range problems {
		probMap[p.ProblemVersionID] = p
	}

	// Map user_id -> LeaderboardRow
	rowsMap := make(map[uuid.UUID]*models.LeaderboardRow)

	// Initialize all registered participants
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
				Label:        p.Label,
				Points:       p.Points,
				AttemptCount: 0,
				Solved:       false,
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

	// Process submissions in chronological order
	for _, sub := range submissions {
		if sub.UserID == nil {
			continue
		}
		row, exists := rowsMap[*sub.UserID]
		if !exists {
			// Auto-add participant row if submission exists
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

		// Submissions after already solved on this problem are ignored for ICPC scoring
		if cell.Solved {
			continue
		}

		// Check if submission is within the freeze period
		isFrozenSub := false
		if maskFrozen && contest.FreezeAt != nil && !sub.CreatedAt.Before(*contest.FreezeAt) {
			isFrozenSub = true
		}

		// Calculate submission minutes from contest start
		var subMinutes int64
		if sub.CreatedAt.After(contest.StartsAt) {
			subMinutes = int64(sub.CreatedAt.Sub(contest.StartsAt).Minutes())
		}

		if isFrozenSub {
			// Submissions during freeze mask the outcome
			cell.AttemptCount++
			cell.IsFrozen = true
			row.Problems[cp.Label] = cell
			continue
		}

		// Non-frozen evaluation
		if sub.Verdict == models.VerdictAC {
			cell.Solved = true
			cell.AttemptCount++
			cell.SolvedTimeMinutes = subMinutes
			cell.Points = cp.Points

			// Add problem penalty: time to solve + (attempts - 1) * 20 min
			probPenalty := subMinutes + int64(cell.AttemptCount-1)*s.PenaltyMinutesPerWrongAttempt
			row.Score++
			row.Penalty += probPenalty

			if row.LastACTime == nil || sub.CreatedAt.After(*row.LastACTime) {
				t := sub.CreatedAt
				row.LastACTime = &t
			}
		} else if sub.Verdict != models.VerdictCE && sub.Verdict != models.VerdictPending {
			// Wrong answer, TLE, MLE, RE incur an attempt count if submitted before AC
			cell.AttemptCount++
		}

		row.Problems[cp.Label] = cell
	}

	// Convert map to slice
	rows := make([]models.LeaderboardRow, 0, len(rowsMap))
	for _, r := range rowsMap {
		rows = append(rows, *r)
	}

	// Sort standings according to standard ICPC ranking rules:
	// 1. Solved problems count (Score) DESC
	// 2. Total Penalty minutes ASC
	// 3. Last AC timestamp ASC (earlier solve breaks ties)
	// 4. UserName ASC
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

	// Assign standard rank (with ties sharing rank)
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
