package handlers

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseProblemMarkdown(t *testing.T) {
	sampleMD := `---
title: "Maximum Subarray Sum"
slug: "max-subarray-sum"
difficulty: "medium"
points: 150
time_limit_ms: 1000
memory_mb: 256
tags:
  - dynamic-programming
  - arrays
---

# Maximum Subarray Sum

Given an array of integers ` + "`nums`" + `, find the contiguous subarray which has the largest sum and return its sum.

### Constraints
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4

### Sample 1
#### Input
` + "```" + `
5
-2 1 -3 4 -1
` + "```" + `
#### Output
` + "```" + `
4
` + "```" + `
#### Explanation
The subarray [4, -1] or [4] has maximum sum.

### Hidden Tests
#### Input
` + "```" + `
1
-5
` + "```" + `
#### Output
` + "```" + `
-5
` + "```" + `
`

	problem, err := ParseProblemMarkdown(sampleMD)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if problem.Title != "Maximum Subarray Sum" {
		t.Errorf("expected title 'Maximum Subarray Sum', got '%s'", problem.Title)
	}
	if problem.Slug != "max-subarray-sum" {
		t.Errorf("expected slug 'max-subarray-sum', got '%s'", problem.Slug)
	}
	if problem.Difficulty != "medium" {
		t.Errorf("expected difficulty 'medium', got '%s'", problem.Difficulty)
	}
	if problem.Points != 150 {
		t.Errorf("expected points 150, got %d", problem.Points)
	}
	if problem.TimeLimitMS != 1000 {
		t.Errorf("expected time limit 1000, got %d", problem.TimeLimitMS)
	}
	if problem.MemoryMB != 256 {
		t.Errorf("expected memory limit 256, got %d", problem.MemoryMB)
	}

	if len(problem.SampleTests) != 1 {
		t.Fatalf("expected 1 sample test case, got %d", len(problem.SampleTests))
	}
	if problem.SampleTests[0].InputData != "5\n-2 1 -3 4 -1" {
		t.Errorf("sample test input mismatch: got %q", problem.SampleTests[0].InputData)
	}
	if problem.SampleTests[0].OutputData != "4" {
		t.Errorf("sample test output mismatch: got %q", problem.SampleTests[0].OutputData)
	}

	if len(problem.HiddenTests) != 1 {
		t.Fatalf("expected 1 hidden test case, got %d", len(problem.HiddenTests))
	}
	if problem.HiddenTests[0].InputData != "1\n-5" {
		t.Errorf("hidden test input mismatch: got %q", problem.HiddenTests[0].InputData)
	}
	if problem.HiddenTests[0].OutputData != "-5" {
		t.Errorf("hidden test output mismatch: got %q", problem.HiddenTests[0].OutputData)
	}

	// Ensure hidden tests are NOT leaked into public statement
	if strings.Contains(problem.StatementMD, "Hidden Tests") {
		t.Errorf("hidden tests leaked into public statement markdown")
	}
}

func TestParseAllCuratedProblems(t *testing.T) {
	// Root relative to repository
	dirs := []string{
		filepath.Join("..", "..", "..", "problems", "easy"),
		filepath.Join("..", "..", "..", "problems", "medium"),
		filepath.Join("..", "..", "..", "problems", "hard"),
	}

	totalParsed := 0

	for _, dir := range dirs {
		files, err := os.ReadDir(dir)
		if err != nil {
			t.Logf("Skipping dir %s: %v", dir, err)
			continue
		}

		for _, file := range files {
			if !strings.HasSuffix(file.Name(), ".md") {
				continue
			}

			fullPath := filepath.Join(dir, file.Name())
			content, err := os.ReadFile(fullPath)
			if err != nil {
				t.Errorf("failed to read file %s: %v", fullPath, err)
				continue
			}

			parsed, err := ParseProblemMarkdown(string(content))
			if err != nil {
				t.Errorf("failed to parse problem %s: %v", fullPath, err)
				continue
			}

			if parsed.Title == "" {
				t.Errorf("problem %s missing title", fullPath)
			}
			if parsed.Slug == "" {
				t.Errorf("problem %s missing slug", fullPath)
			}
			if len(parsed.SampleTests) == 0 {
				t.Errorf("problem %s has no sample tests", fullPath)
			}
			if len(parsed.HiddenTests) == 0 {
				t.Errorf("problem %s has no hidden tests", fullPath)
			}

			totalParsed++
		}
	}

	if totalParsed != 60 {
		t.Logf("Parsed %d curated problems", totalParsed)
	}
}
