package integration

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestEscapeCorpusIntegrity verifies that all required escape attack files exist
// and contain intended attack vectors (fork bombs, memory exhaustion, syscall probes, etc.)
func TestEscapeCorpusIntegrity(t *testing.T) {
	corpusDir := filepath.Join("..", "..", "..", "tests", "escape-corpus")
	files, err := os.ReadDir(corpusDir)
	if err != nil {
		t.Fatalf("Failed to read escape corpus directory: %v", err)
	}

	expectedAttacks := map[string]string{
		"fork_bomb.cpp":      "fork",
		"mem_exhaust.cpp":    "malloc",
		"infinite_loop.cpp":  "while",
		"output_flood.cpp":   "std::cout",
		"syscall_probe.cpp":  "socket",
		"file_traversal.cpp": "/etc/shadow",
		"stack_overflow.cpp": "recurse",
		"thread_bomb.cpp":    "thread",
		"compiler_abuse.cpp": "Factorial",
	}

	foundAttacks := make(map[string]bool)

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".cpp") {
			continue
		}

		filePath := filepath.Join(corpusDir, file.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			t.Errorf("Failed to read %s: %v", file.Name(), err)
			continue
		}

		sourceCode := string(content)
		expectedKeyword, ok := expectedAttacks[file.Name()]
		if !ok {
			t.Logf("Additional escape corpus file: %s", file.Name())
			continue
		}

		if !strings.Contains(sourceCode, expectedKeyword) {
			t.Errorf("File %s does not contain expected attack pattern '%s'", file.Name(), expectedKeyword)
		}
		foundAttacks[file.Name()] = true
	}

	for expected := range expectedAttacks {
		if !foundAttacks[expected] {
			t.Errorf("Missing required escape attack test in corpus: %s", expected)
		}
	}
}
