package standings

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

func TestStandingsManager_CacheAndRoleViews(t *testing.T) {
	broker := events.NewBroker()
	mgr := NewManager(nil, broker)

	contestID := uuid.New()
	publicBoard := &models.Leaderboard{
		ContestID: contestID,
		IsFrozen:  true,
		Rows: []models.LeaderboardRow{
			{
				UserID:   uuid.New(),
				UserName: "coder1",
				Rank:     1,
				Score:    1,
				Penalty:  15,
			},
		},
		UpdatedAt: time.Now().UTC(),
	}

	adminBoard := &models.Leaderboard{
		ContestID: contestID,
		IsFrozen:  false, // Admin sees unmasked
		Rows: []models.LeaderboardRow{
			{
				UserID:   uuid.New(),
				UserName: "coder1",
				Rank:     1,
				Score:    2, // Contains unmasked solves
				Penalty:  45,
			},
		},
		UpdatedAt: time.Now().UTC(),
	}

	mgr.SetCache(contestID, publicBoard, adminBoard)

	// Test public view
	pub, err := mgr.GetLeaderboard(context.Background(), contestID, false)
	if err != nil {
		t.Fatalf("unexpected error getting public leaderboard: %v", err)
	}
	if !pub.IsFrozen {
		t.Errorf("expected public board to be frozen, got false")
	}
	if len(pub.Rows) != 1 || pub.Rows[0].Score != 1 {
		t.Errorf("expected public board score 1, got %d", pub.Rows[0].Score)
	}

	// Test admin view
	adm, err := mgr.GetLeaderboard(context.Background(), contestID, true)
	if err != nil {
		t.Fatalf("unexpected error getting admin leaderboard: %v", err)
	}
	if adm.IsFrozen {
		t.Errorf("expected admin board to be unfrozen, got true")
	}
	if len(adm.Rows) != 1 || adm.Rows[0].Score != 2 {
		t.Errorf("expected admin board score 2, got %d", adm.Rows[0].Score)
	}

	// Test Invalidate
	mgr.Invalidate(contestID)

	// Since db is nil, calling GetLeaderboard after invalidation should fail on DB fetch
	_, err = mgr.GetLeaderboard(context.Background(), contestID, false)
	if err == nil {
		t.Errorf("expected error on DB fetch when cache is empty and db is nil")
	}
}

func TestStandingsManager_ConcurrentAccess(t *testing.T) {
	broker := events.NewBroker()
	mgr := NewManager(nil, broker)

	contestID := uuid.New()
	baseBoard := &models.Leaderboard{
		ContestID: contestID,
		IsFrozen:  false,
		Rows:      []models.LeaderboardRow{},
		UpdatedAt: time.Now().UTC(),
	}
	mgr.SetCache(contestID, baseBoard, baseBoard)

	var wg sync.WaitGroup
	workers := 50
	iterations := 200

	// Multiple readers and writers
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				if id%5 == 0 {
					// Writer
					b := &models.Leaderboard{
						ContestID: contestID,
						IsFrozen:  j%2 == 0,
						Rows: []models.LeaderboardRow{
							{UserName: "worker", Score: j},
						},
						UpdatedAt: time.Now().UTC(),
					}
					mgr.SetCache(contestID, b, b)
				} else {
					// Reader
					isAdmin := id%2 == 0
					board, err := mgr.GetLeaderboard(context.Background(), contestID, isAdmin)
					if err == nil && board == nil {
						t.Errorf("unexpected nil board")
					}
				}
			}
		}(i)
	}

	wg.Wait()
}
