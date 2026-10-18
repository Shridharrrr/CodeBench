package seed

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type ProblemMeta struct {
	Slug         string
	Title        string
	Difficulty   string
	Tags         []string
	TimeLimitMS  int
	MemoryMB     int
	CheckerType  string
}

func SeedDatabase(ctx context.Context, db *database.DB, problemsDir, adminPass string) error {
	slog.Info("Seeding initial data...", "problemsDir", problemsDir)

	// 1. Seed Admin User
	hash, err := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}
	if err := db.UpsertAdminUser(ctx, "Administrator", "admin@codebench.local", string(hash)); err != nil {
		return fmt.Errorf("failed to upsert admin user: %w", err)
	}
	slog.Info("Admin user verified: admin@codebench.local")

	// 2. Seed Problems
	twoSumDir := filepath.Join(problemsDir, "two-sum")
	if _, err := os.Stat(twoSumDir); os.IsNotExist(err) {
		slog.Warn("Two-sum problem dir not found at", "path", twoSumDir)
		return nil
	}

	statementBytes, _ := os.ReadFile(filepath.Join(twoSumDir, "statement.md"))
	statementMD := string(statementBytes)

	// Test cases
	var testCases []models.TestCase

	// Sample tests
	sampleIn, _ := os.ReadFile(filepath.Join(twoSumDir, "tests", "sample", "01.in"))
	sampleOut, _ := os.ReadFile(filepath.Join(twoSumDir, "tests", "sample", "01.out"))
	testCases = append(testCases, models.TestCase{
		GroupName:  "sample",
		Ordinal:    1,
		InputData:  string(sampleIn),
		OutputData: string(sampleOut),
		IsSample:   true,
	})

	// Hidden tests
	h1In, _ := os.ReadFile(filepath.Join(twoSumDir, "tests", "hidden", "001.in"))
	h1Out, _ := os.ReadFile(filepath.Join(twoSumDir, "tests", "hidden", "001.out"))
	testCases = append(testCases, models.TestCase{
		GroupName:  "small",
		Ordinal:    2,
		InputData:  string(h1In),
		OutputData: string(h1Out),
		IsSample:   false,
	})

	h2In, _ := os.ReadFile(filepath.Join(twoSumDir, "tests", "hidden", "002.in"))
	h2Out, _ := os.ReadFile(filepath.Join(twoSumDir, "tests", "hidden", "002.out"))
	testCases = append(testCases, models.TestCase{
		GroupName:  "max-size",
		Ordinal:    3,
		InputData:  string(h2In),
		OutputData: string(h2Out),
		IsSample:   false,
	})

	h := sha256.New()
	h.Write([]byte(statementMD))
	for _, tc := range testCases {
		h.Write([]byte(tc.InputData))
		h.Write([]byte(tc.OutputData))
	}
	pkgHash := hex.EncodeToString(h.Sum(nil))

	_, _, err = db.UpsertProblem(ctx,
		"two-sum",
		"Two Sum",
		statementMD,
		"Easy",
		[]string{"array", "hash-table", "two-pointers"},
		1000,
		256,
		"token",
		pkgHash,
		testCases,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "already exists") {
			slog.Info("Problem two-sum already seeded.")
			return nil
		}
		return fmt.Errorf("failed to upsert two-sum problem: %w", err)
	}

	slog.Info("Problem seeded successfully: two-sum (version 1)")
	return nil
}
