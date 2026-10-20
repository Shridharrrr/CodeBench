package seed

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/codebench/codebench/api/internal/auth"
	"github.com/codebench/codebench/api/internal/database"
)

func SeedDatabase(ctx context.Context, db *database.DB, problemsDir, adminPass string) error {
	slog.Info("Initializing database credentials...")

	// 1. Seed Admin User with Argon2id password hash
	// No hardcoded questions or pre-running contests are seeded.
	// Contests and problems are exclusively configured and launched by the administrator.
	hash, err := auth.HashPassword(adminPass)
	if err != nil {
		return fmt.Errorf("failed to hash admin password with Argon2id: %w", err)
	}
	if err := db.UpsertAdminUser(ctx, "Administrator", "admin@codebench.local", hash); err != nil {
		return fmt.Errorf("failed to upsert admin user: %w", err)
	}
	slog.Info("Admin user verified: admin@codebench.local")

	return nil
}
