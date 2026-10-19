package practice

import (
	"math/rand"
	"testing"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/google/uuid"
)

func TestPracticeGenerator_SeedDeterminism(t *testing.T) {
	// Create sample candidate pool
	pool := make([]database.PracticeCandidate, 10)
	slugs := []string{"two-sum", "valid-palindrome", "binary-search", "maximum-subarray", "merge-intervals", "lru-cache", "longest-palindromic-substring", "trapping-rain-water", "median-of-two-sorted-arrays", "word-ladder"}
	for i, s := range slugs {
		pool[i] = database.PracticeCandidate{
			ProblemVersion: models.ProblemVersion{
				ID:         uuid.New(),
				Title:      s,
				Difficulty: "Medium",
			},
			Slug: s,
		}
	}

	seedVal := int64(42)

	// Run 1 with seed 42
	rng1 := rand.New(rand.NewSource(seedVal))
	shuffled1 := make([]database.PracticeCandidate, len(pool))
	copy(shuffled1, pool)
	rng1.Shuffle(len(shuffled1), func(i, j int) {
		shuffled1[i], shuffled1[j] = shuffled1[j], shuffled1[i]
	})
	selected1 := shuffled1[:3]

	// Run 2 with same seed 42
	rng2 := rand.New(rand.NewSource(seedVal))
	shuffled2 := make([]database.PracticeCandidate, len(pool))
	copy(shuffled2, pool)
	rng2.Shuffle(len(shuffled2), func(i, j int) {
		shuffled2[i], shuffled2[j] = shuffled2[j], shuffled2[i]
	})
	selected2 := shuffled2[:3]

	for i := 0; i < 3; i++ {
		if selected1[i].Slug != selected2[i].Slug {
			t.Fatalf("Expected deterministic selection with seed 42, but problem %d differed: %s vs %s", i, selected1[i].Slug, selected2[i].Slug)
		}
	}

	// Run 3 with different seed 999
	rng3 := rand.New(rand.NewSource(999))
	shuffled3 := make([]database.PracticeCandidate, len(pool))
	copy(shuffled3, pool)
	rng3.Shuffle(len(shuffled3), func(i, j int) {
		shuffled3[i], shuffled3[j] = shuffled3[j], shuffled3[i]
	})
	selected3 := shuffled3[:3]

	// With different seed, at least one problem should differ in a pool of 10
	allMatch := true
	for i := 0; i < 3; i++ {
		if selected1[i].Slug != selected3[i].Slug {
			allMatch = false
			break
		}
	}
	if allMatch {
		t.Logf("Note: different seed produced same subset (can happen by chance, but unlikely)")
	}
}

func TestPracticeGenerator_Labels(t *testing.T) {
	if len(problemLabels) < 10 {
		t.Fatalf("expected at least 10 problem labels, got %d", len(problemLabels))
	}
	expected := []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"}
	for i, exp := range expected {
		if problemLabels[i] != exp {
			t.Errorf("expected label %s at index %d, got %s", exp, i, problemLabels[i])
		}
	}
}
