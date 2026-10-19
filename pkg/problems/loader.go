package problems

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	MaxFileSizeBytes    = 10 * 1024 * 1024 // 10 MB per individual test file
	MaxPackageSizeBytes = 64 * 1024 * 1024 // 64 MB total package cap
)

// LoadPackage safely reads and parses a problem package directory
func LoadPackage(dirPath string) (*ProblemPackage, error) {
	cleanDir := filepath.Clean(dirPath)

	// Guard against symlinks on problem directory
	fi, err := os.Lstat(cleanDir)
	if err != nil {
		return nil, fmt.Errorf("failed to stat problem package directory: %w", err)
	}
	if fi.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("problem package directory cannot be a symbolic link")
	}
	if !fi.IsDir() {
		return nil, fmt.Errorf("problem package path %q is not a directory", cleanDir)
	}

	// 1. Read problem.yaml
	yamlPath := filepath.Join(cleanDir, "problem.yaml")
	yamlBytes, err := readSafeFile(yamlPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read problem.yaml: %w", err)
	}
	manifest, err := ParseProblemYAML(yamlBytes)
	if err != nil {
		return nil, fmt.Errorf("manifest validation error: %w", err)
	}

	// 2. Read statement.md
	stmtPath := filepath.Join(cleanDir, "statement.md")
	stmtBytes, err := readSafeFile(stmtPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read statement.md: %w", err)
	}
	statementMD := string(stmtBytes)
	if len(strings.TrimSpace(statementMD)) == 0 {
		return nil, fmt.Errorf("statement.md cannot be empty")
	}

	// 3. Read reference solution
	refPath := filepath.Join(cleanDir, "solution", "ref.cpp")
	refBytes, err := readSafeFile(refPath)
	if err != nil {
		return nil, fmt.Errorf("missing or invalid reference solution (solution/ref.cpp): %w", err)
	}
	refSolution := string(refBytes)
	if len(strings.TrimSpace(refSolution)) == 0 {
		return nil, fmt.Errorf("solution/ref.cpp cannot be empty")
	}

	// 4. Read deliberate wrong solutions
	wrongDir := filepath.Join(cleanDir, "solution", "wrong")
	var wrongSolutions []WrongSolution
	if wEntries, err := os.ReadDir(wrongDir); err == nil {
		for _, we := range wEntries {
			if we.IsDir() || !strings.HasSuffix(we.Name(), ".cpp") {
				continue
			}
			wPath := filepath.Join(wrongDir, we.Name())
			wBytes, err := readSafeFile(wPath)
			if err != nil {
				continue
			}

			lower := strings.ToLower(we.Name())
			expected := "WA"
			if strings.Contains(lower, "tle") {
				expected = "TLE"
			} else if strings.Contains(lower, "mle") {
				expected = "MLE"
			} else if strings.Contains(lower, "re") {
				expected = "RE"
			} else if strings.Contains(lower, "ce") {
				expected = "CE"
			}

			wrongSolutions = append(wrongSolutions, WrongSolution{
				Filename:        we.Name(),
				ExpectedVerdict: expected,
				SourceCode:      string(wBytes),
			})
		}
	}

	// 5. Read Test Cases (sample and hidden)
	var testCases []ProblemTestCase
	testsDir := filepath.Join(cleanDir, "tests")

	// Sample tests
	sampleDir := filepath.Join(testsDir, "sample")
	sampleCases, err := loadTestDir(sampleDir, "sample", true)
	if err != nil {
		return nil, fmt.Errorf("failed loading sample tests: %w", err)
	}
	if len(sampleCases) == 0 {
		return nil, fmt.Errorf("no sample test cases found in tests/sample/")
	}
	testCases = append(testCases, sampleCases...)

	// Hidden tests
	hiddenDir := filepath.Join(testsDir, "hidden")
	hiddenCases, err := loadTestDir(hiddenDir, "hidden", false)
	if err != nil {
		return nil, fmt.Errorf("failed loading hidden tests: %w", err)
	}
	if len(hiddenCases) == 0 {
		return nil, fmt.Errorf("no hidden test cases found in tests/hidden/")
	}
	testCases = append(testCases, hiddenCases...)

	// Assign ordinals
	for i := range testCases {
		testCases[i].Ordinal = i + 1
	}

	pkg := &ProblemPackage{
		Directory:      cleanDir,
		Manifest:       *manifest,
		StatementMD:    statementMD,
		RefSolution:    refSolution,
		WrongSolutions: wrongSolutions,
		TestCases:      testCases,
	}
	pkg.CanonicalHash = ComputeCanonicalHash(pkg)

	return pkg, nil
}

func loadTestDir(dir string, defaultGroup string, isSample bool) ([]ProblemTestCase, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	inFiles := make(map[string]string)
	outFiles := make(map[string]string)

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".in") {
			base := strings.TrimSuffix(name, ".in")
			inFiles[base] = filepath.Join(dir, name)
		} else if strings.HasSuffix(name, ".out") {
			base := strings.TrimSuffix(name, ".out")
			outFiles[base] = filepath.Join(dir, name)
		}
	}

	var baseNames []string
	for base := range inFiles {
		baseNames = append(baseNames, base)
	}
	sort.Strings(baseNames)

	var cases []ProblemTestCase
	for _, base := range baseNames {
		outPath, ok := outFiles[base]
		if !ok {
			return nil, fmt.Errorf("test %q has .in file but missing matching .out file in %s", base, dir)
		}

		inBytes, err := readSafeFile(inFiles[base])
		if err != nil {
			return nil, fmt.Errorf("failed reading %s: %w", inFiles[base], err)
		}
		outBytes, err := readSafeFile(outPath)
		if err != nil {
			return nil, fmt.Errorf("failed reading %s: %w", outPath, err)
		}

		group := defaultGroup
		if strings.Contains(base, "small") {
			group = "small"
		} else if strings.Contains(base, "max") {
			group = "max-size"
		}

		cases = append(cases, ProblemTestCase{
			GroupName:  group,
			Name:       base,
			InputData:  string(inBytes),
			OutputData: string(outBytes),
			IsSample:   isSample,
		})
	}

	return cases, nil
}

func readSafeFile(path string) ([]byte, error) {
	fi, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if fi.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("symlinks are forbidden: %s", path)
	}
	if fi.Size() > MaxFileSizeBytes {
		return nil, fmt.Errorf("file %s exceeds maximum size limit (%d bytes)", path, MaxFileSizeBytes)
	}
	return os.ReadFile(path)
}

// ComputeCanonicalHash returns a deterministic SHA-256 of the package contents
func ComputeCanonicalHash(pkg *ProblemPackage) string {
	h := sha256.New()
	h.Write([]byte(pkg.Manifest.Slug))
	h.Write([]byte(fmt.Sprintf("%d", pkg.Manifest.Version)))
	h.Write([]byte(pkg.Manifest.Title))
	h.Write([]byte(pkg.Manifest.Difficulty))
	h.Write([]byte(pkg.StatementMD))
	h.Write([]byte(pkg.RefSolution))

	for _, tc := range pkg.TestCases {
		h.Write([]byte(tc.GroupName))
		h.Write([]byte(fmt.Sprintf("%d", tc.Ordinal)))
		h.Write([]byte(tc.InputData))
		h.Write([]byte(tc.OutputData))
	}

	return hex.EncodeToString(h.Sum(nil))
}
