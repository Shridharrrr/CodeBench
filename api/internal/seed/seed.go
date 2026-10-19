package seed

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/database"
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

	return nil
}
