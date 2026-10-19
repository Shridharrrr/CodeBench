package problems

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// FuzzLoadPackage validates that malformed, truncated, or hostile problem.yaml inputs
// fail gracefully with descriptive errors and never cause runtime panics.
func FuzzLoadPackage(f *testing.F) {
	// Seed corpus
	f.Add([]byte("slug: test-problem\nversion: 1\ntitle: Test\ndifficulty: Easy\nlimits:\n  time_ms: 1000\n  memory_mb: 256\nchecker:\n  type: token\n"))
	f.Add([]byte("slug: \"../../traversal\"\nversion: -1\ntitle: \"\"\nlimits:\n  time_ms: -500\n"))
	f.Add([]byte("invalid: [yaml: {broken: ::::"))
	f.Add([]byte("\x00\xff\xfe\xfd\x00\x00"))
	f.Add([]byte("slug: test\nversion: 999999999999999999999999999999999999999\n"))

	f.Fuzz(func(t *testing.T, data []byte) {
		tempDir, err := os.MkdirTemp("", "codebench-fuzz-*")
		if err != nil {
			return
		}
		defer os.RemoveAll(tempDir)

		yamlPath := filepath.Join(tempDir, "problem.yaml")
		if err := os.WriteFile(yamlPath, data, 0644); err != nil {
			return
		}

		// Ensure LoadPackage handles arbitrary input safely
		pkg, err := LoadPackage(tempDir)
		if err != nil {
			// Clean failure expected for invalid inputs
			return
		}

		// If package parsed, ensure validation does not panic
		ctx := context.Background()
		_, _ = ValidatePackage(ctx, pkg)
	})
}
