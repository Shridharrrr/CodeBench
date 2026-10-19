package problems

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestParseProblemYAML_Valid(t *testing.T) {
	validYAML := `
slug: valid-problem
version: 1
title: Valid Problem
difficulty: Medium
tags:
  - dp
  - math
languages:
  - cpp23-gcc
  - cpp23-clang
limits:
  time_limit_ms: 1500
  memory_limit_mb: 512
checker:
  type: token
complexity:
  policy: query_or_scaling
  time_complexity: "O(N)"
  space_complexity: "O(1)"
test_groups:
  - name: sample
    weight: 0
  - name: max-size
    weight: 100
`
	manifest, err := ParseProblemYAML([]byte(validYAML))
	if err != nil {
		t.Fatalf("unexpected error parsing valid manifest: %v", err)
	}
	if manifest.Slug != "valid-problem" {
		t.Errorf("expected slug 'valid-problem', got %q", manifest.Slug)
	}
	if manifest.Limits.TimeLimitMS != 1500 {
		t.Errorf("expected time_limit_ms 1500, got %d", manifest.Limits.TimeLimitMS)
	}
}

func TestParseProblemYAML_UnknownFieldRejected(t *testing.T) {
	badYAML := `
slug: test-slug
version: 1
title: Test
difficulty: Easy
languages:
  - cpp23-gcc
limits:
  time_limit_ms: 1000
  memory_limit_mb: 256
checker:
  type: token
test_groups:
  - name: sample
    weight: 100
unknown_forbidden_field: true
`
	_, err := ParseProblemYAML([]byte(badYAML))
	if err == nil {
		t.Fatalf("expected error for unknown field in YAML, got nil")
	}
}

func TestParseProblemYAML_InvalidSlug(t *testing.T) {
	invalidSlugs := []string{
		"Invalid_Slug",
		"slug with spaces",
		"-leading-dash",
		"trailing-dash-",
		"UPPERCASE",
		"slug!@#",
	}

	for _, s := range invalidSlugs {
		yamlStr := `
slug: ` + s + `
version: 1
title: Test
difficulty: Easy
languages:
  - cpp23-gcc
limits:
  time_limit_ms: 1000
  memory_limit_mb: 256
checker:
  type: token
test_groups:
  - name: sample
    weight: 100
`
		_, err := ParseProblemYAML([]byte(yamlStr))
		if err == nil {
			t.Errorf("expected error for invalid slug %q, got nil", s)
		}
	}
}

func TestCanonicalHashDeterminism(t *testing.T) {
	pkg1 := &ProblemPackage{
		Manifest: ProblemYAML{
			Slug:       "two-sum",
			Version:    1,
			Title:      "Two Sum",
			Difficulty: "Easy",
		},
		StatementMD: "# Two Sum",
		RefSolution: "int main(){}",
		TestCases: []ProblemTestCase{
			{GroupName: "sample", Ordinal: 1, InputData: "4 9\n2 7 11 15", OutputData: "0 1"},
		},
	}

	pkg2 := &ProblemPackage{
		Manifest: ProblemYAML{
			Slug:       "two-sum",
			Version:    1,
			Title:      "Two Sum",
			Difficulty: "Easy",
		},
		StatementMD: "# Two Sum",
		RefSolution: "int main(){}",
		TestCases: []ProblemTestCase{
			{GroupName: "sample", Ordinal: 1, InputData: "4 9\n2 7 11 15", OutputData: "0 1"},
		},
	}

	h1 := ComputeCanonicalHash(pkg1)
	h2 := ComputeCanonicalHash(pkg2)

	if h1 != h2 {
		t.Errorf("hashes should be identical: %s vs %s", h1, h2)
	}
	if len(h1) != 64 {
		t.Errorf("expected 64-char hex hash, got %d", len(h1))
	}
}

func TestLoadPackage_Validation(t *testing.T) {
	dir := filepath.Join("..", "..", "problems", "two-sum")
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Skip("two-sum problem directory not found from test runner")
	}

	pkg, err := LoadPackage(dir)
	if err != nil {
		t.Fatalf("failed to load two-sum package: %v", err)
	}

	if pkg.Manifest.Slug != "two-sum" {
		t.Errorf("expected slug 'two-sum', got %q", pkg.Manifest.Slug)
	}
	if len(pkg.TestCases) < 3 {
		t.Errorf("expected at least 3 test cases, got %d", len(pkg.TestCases))
	}

	report, err := ValidatePackage(context.Background(), pkg)
	if err != nil {
		t.Fatalf("validation execution failed: %v", err)
	}
	if !report.Passed {
		t.Errorf("expected two-sum to pass validation, got errors: %v", report.Errors)
	}
}
