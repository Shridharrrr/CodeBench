package tests

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/codebench/codebench/pkg/problems"
)

// TestSetupAcceptance_Preflight ensures that a fresh clone has all required
// service definitions, problem packages, and valid configuration without manual intervention.
func TestSetupAcceptance_Preflight(t *testing.T) {
	workspaceRoot := ".."

	// 1. Verify compose.yaml exists and defines core microservices
	composePath := filepath.Join(workspaceRoot, "compose.yaml")
	composeBytes, err := os.ReadFile(composePath)
	if err != nil {
		t.Fatalf("SAT Failed: compose.yaml missing in root: %v", err)
	}
	composeStr := string(composeBytes)
	for _, svc := range []string{"postgres:", "api:", "judge:"} {
		if !strings.Contains(composeStr, svc) {
			t.Errorf("SAT Failed: compose.yaml missing service definition for %s", svc)
		}
	}

	// 2. Verify all 10 reference problem packages exist with valid YAML manifests
	problemsDir := filepath.Join(workspaceRoot, "problems")
	entries, err := os.ReadDir(problemsDir)
	if err != nil || len(entries) == 0 {
		t.Fatalf("SAT Failed: problems directory missing or empty: %v", err)
	}

	expectedProblems := []string{
		"binary-search",
		"longest-palindromic-substring",
		"lru-cache",
		"maximum-subarray",
		"median-of-two-sorted-arrays",
		"merge-intervals",
		"trapping-rain-water",
		"two-sum",
		"valid-palindrome",
		"word-ladder",
	}

	validCount := 0
	ctx := context.Background()

	for _, expected := range expectedProblems {
		probPath := filepath.Join(problemsDir, expected)
		yamlPath := filepath.Join(probPath, "problem.yaml")
		if _, err := os.Stat(yamlPath); err != nil {
			t.Errorf("SAT Warning: problem %s missing problem.yaml: %v", expected, err)
			continue
		}
		pkg, err := problems.LoadPackage(probPath)
		if err != nil {
			t.Errorf("SAT Failed: failed to load package for %s: %v", expected, err)
			continue
		}
		if pkg.Manifest.Slug == "" {
			t.Errorf("SAT Failed: package %s has empty slug", expected)
		}

		report, err := problems.ValidatePackage(ctx, pkg)
		if err != nil || !report.Passed {
			t.Errorf("SAT Failed: package %s failed validation: %v, err=%v", expected, report.Errors, err)
			continue
		}

		validCount++
	}

	if validCount < 10 {
		t.Fatalf("SAT Failed: expected 10 valid problem packages, got %d", validCount)
	}
}

// TestSetupAcceptance_DockerSecurityHardening verifies that all Dockerfiles enforce
// non-root execution and drop privileges for defense-in-depth container containment.
func TestSetupAcceptance_DockerSecurityHardening(t *testing.T) {
	workspaceRoot := ".."

	apiDockerBytes, err := os.ReadFile(filepath.Join(workspaceRoot, "deploy", "api.Dockerfile"))
	if err != nil {
		t.Fatalf("SAT Failed: deploy/api.Dockerfile missing: %v", err)
	}
	apiDockerStr := string(apiDockerBytes)

	if !strings.Contains(apiDockerStr, "USER 10001:10001") {
		t.Errorf("SAT Failed: api.Dockerfile must enforce non-root user (USER 10001:10001)")
	}
	if !strings.Contains(apiDockerStr, "addgroup -g 10001") {
		t.Errorf("SAT Failed: api.Dockerfile must create unprivileged codebench user/group (10001)")
	}

	judgeDockerBytes, err := os.ReadFile(filepath.Join(workspaceRoot, "deploy", "judge.Dockerfile"))
	if err != nil {
		t.Fatalf("SAT Failed: deploy/judge.Dockerfile missing: %v", err)
	}
	judgeDockerStr := string(judgeDockerBytes)

	if !strings.Contains(judgeDockerStr, "10001") {
		t.Errorf("SAT Failed: judge.Dockerfile must provision dedicated unprivileged user 10001")
	}
	if !strings.Contains(judgeDockerStr, "groupadd -g 10001 codebench") {
		t.Errorf("SAT Failed: judge.Dockerfile must create unprivileged codebench group (10001)")
	}
}
