package seed

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/google/uuid"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
)

func SeedDatabase(ctx context.Context, db *database.DB, problemsDir, adminPass string) error {
	slog.Info("Seeding initial data...", "problemsDir", problemsDir)

	// 1. Seed Admin User with Argon2id password hash
	hash, err := auth.HashPassword(adminPass)
	if err != nil {
		return fmt.Errorf("failed to hash admin password with Argon2id: %w", err)
	}
	if err := db.UpsertAdminUser(ctx, "Administrator", "admin@codebench.local", hash); err != nil {
		return fmt.Errorf("failed to upsert admin user: %w", err)
	}
	slog.Info("Admin user verified: admin@codebench.local")

	// 2. Seed Problems via Problem Package Importer
	if _, err := os.Stat(problemsDir); os.IsNotExist(err) {
		slog.Warn("Problems directory not found at", "path", problemsDir)
		return nil
	}

	results, err := ImportAll(ctx, db, problemsDir)
	if err != nil {
		slog.Warn("Problem importing encountered error during seed", "error", err)
	} else {
		for _, res := range results {
			slog.Info("Problem package imported",
				"slug", res.Slug,
				"version", res.Version,
				"title", res.Title,
				"tests", res.TestCount,
				"hash", res.PackageHash[:12],
			)
		}
	}

	// 3. Seed Default Fixed 10-Problem Contest if none exists
	contests, err := db.ListContests(ctx, "fixed")
	if err == nil && len(contests) == 0 {
		var contestProblems []models.ContestProblem
		labels := []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"}
		orderedSlugs := []string{
			"two-sum",
			"valid-palindrome",
			"binary-search",
			"maximum-subarray",
			"merge-intervals",
			"lru-cache",
			"longest-palindromic-substring",
			"trapping-rain-water",
			"median-of-two-sorted-arrays",
			"word-ladder",
		}

		for idx, slug := range orderedSlugs {
			_, pv, _, err := db.GetProblemBySlug(ctx, slug)
			if err == nil && pv != nil {
				contestProblems = append(contestProblems, models.ContestProblem{
					ProblemVersionID: pv.ID,
					Label:            labels[idx],
					Points:           100,
				})
			}
		}

		if len(contestProblems) > 0 {
			now := time.Now().UTC()
			startsAt := now.Add(-1 * time.Hour)
			endsAt := now.Add(23 * time.Hour)
			freezeAt := now.Add(22 * time.Hour)

			demoContest := &models.Contest{
				ID:        uuid.New(),
				Title:     "Codebench Inaugural Contest (10 Problems)",
				Mode:      "fixed",
				StartsAt:  startsAt,
				EndsAt:    endsAt,
				FreezeAt:  &freezeAt,
				Scoring:   "icpc",
				CreatedAt: now,
			}

			if err := db.CreateContest(ctx, demoContest, contestProblems); err != nil {
				slog.Warn("Failed to seed default contest", "error", err)
			} else {
				slog.Info("Default 10-problem contest seeded successfully", "contest_id", demoContest.ID, "problems", len(contestProblems))
			}
		}
	}

	return nil
}
