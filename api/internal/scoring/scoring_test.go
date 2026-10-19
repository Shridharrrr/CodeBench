package scoring

import (
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

func TestICPCScorer_BasicAndTieBreaking(t *testing.T) {
	now := time.Now().UTC()
	startTime := now.Add(-2 * time.Hour)
	endTime := now.Add(2 * time.Hour)

	contest := &models.Contest{
		ID:       uuid.New(),
		Title:    "Test ICPC Contest",
		Mode:     "fixed",
		StartsAt: startTime,
		EndsAt:   endTime,
		Scoring:  "icpc",
	}

	p1VerID := uuid.New()
	p2VerID := uuid.New()

	problems := []models.ContestProblem{
		{ContestID: contest.ID, ProblemVersionID: p1VerID, Label: "A", Points: 100},
		{ContestID: contest.ID, ProblemVersionID: p2VerID, Label: "B", Points: 100},
	}

	user1ID := uuid.New()
	user2ID := uuid.New()
	user3ID := uuid.New()

	participants := []models.Participant{
		{ContestID: contest.ID, UserID: user1ID, UserName: "Alice"},
		{ContestID: contest.ID, UserID: user2ID, UserName: "Bob"},
		{ContestID: contest.ID, UserID: user3ID, UserName: "Charlie"},
	}

	// Submissions scenario:
	// Alice:
	//   Problem A: WA at +10 min, AC at +20 min => Solved 1, Penalty = 20 + 20 = 40 min
	// Bob:
	//   Problem A: AC at +25 min (0 WAs) => Solved 1, Penalty = 25 min
	// Charlie:
	//   Problem A: WA at +5 min, WA at +15 min (Never solved => 0 penalty)
	//
	// Expected ranking:
	// 1. Bob (1 solved, 25 penalty)
	// 2. Alice (1 solved, 40 penalty)
	// 3. Charlie (0 solved, 0 penalty)

	submissions := []models.Submission{
		// Alice
		{
			ID:               uuid.New(),
			UserID:           &user1ID,
			ProblemVersionID: p1VerID,
			Verdict:          models.VerdictWA,
			CreatedAt:        startTime.Add(10 * time.Minute),
		},
		{
			ID:               uuid.New(),
			UserID:           &user1ID,
			ProblemVersionID: p1VerID,
			Verdict:          models.VerdictAC,
			CreatedAt:        startTime.Add(20 * time.Minute),
		},
		// Bob
		{
			ID:               uuid.New(),
			UserID:           &user2ID,
			ProblemVersionID: p1VerID,
			Verdict:          models.VerdictAC,
			CreatedAt:        startTime.Add(25 * time.Minute),
		},
		// Charlie
		{
			ID:               uuid.New(),
			UserID:           &user3ID,
			ProblemVersionID: p1VerID,
			Verdict:          models.VerdictWA,
			CreatedAt:        startTime.Add(5 * time.Minute),
		},
		{
			ID:               uuid.New(),
			UserID:           &user3ID,
			ProblemVersionID: p1VerID,
			Verdict:          models.VerdictWA,
			CreatedAt:        startTime.Add(15 * time.Minute),
		},
	}

	scorer := NewICPCScorer()
	board := scorer.ComputeStandings(contest, problems, participants, submissions, now, false)

	if len(board.Rows) != 3 {
		t.Fatalf("Expected 3 rows on leaderboard, got %d", len(board.Rows))
	}

	// Verify Rank 1: Bob
	if board.Rows[0].UserID != user2ID {
		t.Errorf("Rank 1 expected Bob (%v), got %s (%v)", user2ID, board.Rows[0].UserName, board.Rows[0].UserID)
	}
	if board.Rows[0].Score != 1 || board.Rows[0].Penalty != 25 {
		t.Errorf("Bob score/penalty mismatch: expected 1 / 25, got %d / %d", board.Rows[0].Score, board.Rows[0].Penalty)
	}

	// Verify Rank 2: Alice
	if board.Rows[1].UserID != user1ID {
		t.Errorf("Rank 2 expected Alice (%v), got %s (%v)", user1ID, board.Rows[1].UserName, board.Rows[1].UserID)
	}
	if board.Rows[1].Score != 1 || board.Rows[1].Penalty != 40 {
		t.Errorf("Alice score/penalty mismatch: expected 1 / 40, got %d / %d", board.Rows[1].Score, board.Rows[1].Penalty)
	}

	// Verify Rank 3: Charlie
	if board.Rows[2].UserID != user3ID {
		t.Errorf("Rank 3 expected Charlie (%v), got %s (%v)", user3ID, board.Rows[2].UserName, board.Rows[2].UserID)
	}
	if board.Rows[2].Score != 0 || board.Rows[2].Penalty != 0 {
		t.Errorf("Charlie score/penalty mismatch: expected 0 / 0, got %d / %d", board.Rows[2].Score, board.Rows[2].Penalty)
	}
}

func TestICPCScorer_SubmissionsAfterACIgnored(t *testing.T) {
	startTime := time.Now().UTC().Add(-2 * time.Hour)
	contest := &models.Contest{
		ID:       uuid.New(),
		StartsAt: startTime,
		EndsAt:   startTime.Add(3 * time.Hour),
		Scoring:  "icpc",
	}

	pID := uuid.New()
	problems := []models.ContestProblem{{ContestID: contest.ID, ProblemVersionID: pID, Label: "A", Points: 100}}
	uID := uuid.New()
	participants := []models.Participant{{ContestID: contest.ID, UserID: uID, UserName: "Dan"}}

	submissions := []models.Submission{
		{UserID: &uID, ProblemVersionID: pID, Verdict: models.VerdictAC, CreatedAt: startTime.Add(30 * time.Minute)},
		// Extra submissions after AC must be ignored
		{UserID: &uID, ProblemVersionID: pID, Verdict: models.VerdictWA, CreatedAt: startTime.Add(40 * time.Minute)},
		{UserID: &uID, ProblemVersionID: pID, Verdict: models.VerdictAC, CreatedAt: startTime.Add(50 * time.Minute)},
	}

	scorer := NewICPCScorer()
	board := scorer.ComputeStandings(contest, problems, participants, submissions, time.Now().UTC(), false)

	if board.Rows[0].Score != 1 {
		t.Errorf("Expected score 1, got %d", board.Rows[0].Score)
	}
	if board.Rows[0].Penalty != 30 {
		t.Errorf("Expected penalty 30, got %d", board.Rows[0].Penalty)
	}
	if board.Rows[0].Problems["A"].AttemptCount != 1 {
		t.Errorf("Expected attempt count 1, got %d", board.Rows[0].Problems["A"].AttemptCount)
	}
}

func TestICPCScorer_FreezeMasking(t *testing.T) {
	startTime := time.Now().UTC().Add(-2 * time.Hour)
	freezeTime := startTime.Add(90 * time.Minute) // Freeze at 90 min
	endTime := startTime.Add(120 * time.Minute)

	contest := &models.Contest{
		ID:       uuid.New(),
		StartsAt: startTime,
		FreezeAt: &freezeTime,
		EndsAt:   endTime,
		Scoring:  "icpc",
	}

	pID := uuid.New()
	problems := []models.ContestProblem{{ContestID: contest.ID, ProblemVersionID: pID, Label: "A", Points: 100}}
	uID := uuid.New()
	participants := []models.Participant{{ContestID: contest.ID, UserID: uID, UserName: "Eve"}}

	// Eve solves problem A at +100 min (DURING FREEZE)
	submissions := []models.Submission{
		{UserID: &uID, ProblemVersionID: pID, Verdict: models.VerdictAC, CreatedAt: startTime.Add(100 * time.Minute)},
	}

	scorer := NewICPCScorer()

	// 1. Under freeze (masked for public view)
	publicBoard := scorer.ComputeStandings(contest, problems, participants, submissions, startTime.Add(105*time.Minute), true)
	if !publicBoard.IsFrozen {
		t.Fatalf("Expected public board to be marked IsFrozen")
	}
	if publicBoard.Rows[0].Score != 0 {
		t.Errorf("Expected public score to be 0 (masked), got %d", publicBoard.Rows[0].Score)
	}
	if !publicBoard.Rows[0].Problems["A"].IsFrozen {
		t.Errorf("Expected cell A to be marked IsFrozen")
	}

	// 2. Unfrozen / Admin view (maskFrozen = false)
	adminBoard := scorer.ComputeStandings(contest, problems, participants, submissions, startTime.Add(105*time.Minute), false)
	if adminBoard.Rows[0].Score != 1 {
		t.Errorf("Expected admin score to be 1, got %d", adminBoard.Rows[0].Score)
	}
	if !adminBoard.Rows[0].Problems["A"].Solved {
		t.Errorf("Expected cell A to be marked Solved in admin view")
	}
}
