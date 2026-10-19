package seed

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/pkg/problems"
)

type ImportResult struct {
	Slug            string                     `json:"slug"`
	Version         int                        `json:"version"`
	Title           string                     `json:"title"`
	TestCount       int                        `json:"test_count"`
	PackageHash     string                     `json:"package_hash"`
	AlreadyUpToDate bool                       `json:"already_up_to_date"`
	Report          *problems.ValidationReport `json:"validation_report,omitempty"`
}

// ImportPackage loads, validates, and persists a problem package into PostgreSQL
func ImportPackage(ctx context.Context, db *database.DB, pkgDir string) (*ImportResult, error) {
	// 1. Load Package
	pkg, err := problems.LoadPackage(pkgDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load problem package: %w", err)
	}

	// 2. Validate Package
	report, err := problems.ValidatePackage(ctx, pkg)
	if err != nil {
		return nil, fmt.Errorf("package validation execution error: %w", err)
	}
	if !report.Passed {
		return nil, fmt.Errorf("package validation failed with %d error(s): %v", len(report.Errors), report.Errors)
	}

	// 3. Prepare Test Cases for DB
	var dbTestCases []models.TestCase
	for _, tc := range pkg.TestCases {
		dbTestCases = append(dbTestCases, models.TestCase{
			GroupName:  tc.GroupName,
			Ordinal:    tc.Ordinal,
			InputData:  tc.InputData,
			OutputData: tc.OutputData,
			IsSample:   tc.IsSample,
		})
	}

	compPolicy := map[string]any{
		"policy":           pkg.Manifest.Complexity.Policy,
		"time_complexity":  pkg.Manifest.Complexity.TimeComplexity,
		"space_complexity": pkg.Manifest.Complexity.SpaceComplexity,
		"max_queries":      pkg.Manifest.Complexity.MaxQueries,
	}

	// 4. Upsert into database
	_, pv, err := db.UpsertProblem(
		ctx,
		pkg.Manifest.Slug,
		pkg.Manifest.Title,
		pkg.StatementMD,
		pkg.Manifest.Difficulty,
		pkg.Manifest.Tags,
		pkg.Manifest.Limits.TimeLimitMS,
		pkg.Manifest.Limits.MemoryLimitMB,
		pkg.Manifest.Checker.Type,
		pkg.CanonicalHash,
		compPolicy,
		dbTestCases,
	)
	if err != nil {
		return nil, fmt.Errorf("database upsert failed: %w", err)
	}

	res := &ImportResult{
		Slug:        pkg.Manifest.Slug,
		Version:     pv.Version,
		Title:       pv.Title,
		TestCount:   len(dbTestCases),
		PackageHash: pkg.CanonicalHash,
		Report:      report,
	}

	return res, nil
}

// ImportAll discovers and imports all problem packages under a root directory
func ImportAll(ctx context.Context, db *database.DB, problemsRoot string) ([]*ImportResult, error) {
	entries, err := os.ReadDir(problemsRoot)
	if err != nil {
		return nil, fmt.Errorf("failed to read problems directory: %w", err)
	}

	var results []*ImportResult
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		subDir := filepath.Join(problemsRoot, e.Name())
		if _, err := os.Stat(filepath.Join(subDir, "problem.yaml")); err == nil {
			res, err := ImportPackage(ctx, db, subDir)
			if err != nil {
				return results, fmt.Errorf("failed importing %q: %w", e.Name(), err)
			}
			results = append(results, res)
		}
	}

	return results, nil
}
