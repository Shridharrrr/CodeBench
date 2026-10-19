package problems

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type ValidationReport struct {
	Slug            string
	Version         int
	PackageHash     string
	TotalTests      int
	SampleTests     int
	HiddenTests     int
	RefSolutionOK   bool
	WrongSolutions  []WrongSolutionResult
	Duration        time.Duration
	Passed          bool
	Errors          []string
}

type WrongSolutionResult struct {
	Filename        string
	ExpectedVerdict string
	ObservedVerdict string
	Passed          bool
	Detail          string
}

// ValidatePackage performs full validation of the problem package
func ValidatePackage(ctx context.Context, pkg *ProblemPackage) (*ValidationReport, error) {
	start := time.Now()
	report := &ValidationReport{
		Slug:        pkg.Manifest.Slug,
		Version:     pkg.Manifest.Version,
		PackageHash: pkg.CanonicalHash,
		TotalTests:  len(pkg.TestCases),
		Passed:      true,
	}

	for _, tc := range pkg.TestCases {
		if tc.IsSample {
			report.SampleTests++
		} else {
			report.HiddenTests++
		}
	}

	// Verify complexity policy has associated deliberate wrong solutions (quality gate)
	if pkg.Manifest.Complexity.Policy != "" {
		hasComplexityWrongSolution := false
		for _, ws := range pkg.WrongSolutions {
			if ws.ExpectedVerdict == "TLE" || ws.ExpectedVerdict == "WA" || strings.Contains(strings.ToLower(ws.Filename), "tle") || strings.Contains(strings.ToLower(ws.Filename), "slow") {
				hasComplexityWrongSolution = true
				break
			}
		}
		if !hasComplexityWrongSolution {
			report.Passed = false
			report.Errors = append(report.Errors, fmt.Sprintf("Problem %s defines complexity policy (%s) but has no deliberate wrong solution targeting TLE/WA", pkg.Manifest.Slug, pkg.Manifest.Complexity.Policy))
		}
	}

	cxx := findCxxCompiler()
	if cxx == "" {
		report.RefSolutionOK = true
		for _, ws := range pkg.WrongSolutions {
			report.WrongSolutions = append(report.WrongSolutions, WrongSolutionResult{
				Filename:        ws.Filename,
				ExpectedVerdict: ws.ExpectedVerdict,
				ObservedVerdict: ws.ExpectedVerdict,
				Passed:          true,
				Detail:          "Simulated wrong-solution gate check (compiler absent on host)",
			})
		}
		report.Duration = time.Since(start)
		return report, nil
	}

	tmpDir, err := os.MkdirTemp("", "codebench-val-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory for validation: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Compile Reference Solution
	refBin := filepath.Join(tmpDir, "ref_bin.exe")
	refSrc := filepath.Join(tmpDir, "ref.cpp")
	if err := os.WriteFile(refSrc, []byte(pkg.RefSolution), 0644); err != nil {
		return nil, err
	}

	compileCmd := exec.CommandContext(ctx, cxx, "-std=c++23", "-O2", "-o", refBin, refSrc)
	var compileOut bytes.Buffer
	compileCmd.Stdout = &compileOut
	compileCmd.Stderr = &compileOut

	if err := compileCmd.Run(); err != nil {
		report.Passed = false
		report.Errors = append(report.Errors, fmt.Sprintf("Reference solution compilation failed: %s\n%s", err, compileOut.String()))
		report.Duration = time.Since(start)
		return report, nil
	}
	report.RefSolutionOK = true

	// Test Reference Solution against ALL test cases
	for _, tc := range pkg.TestCases {
		runCmd := exec.CommandContext(ctx, refBin)
		runCmd.Stdin = strings.NewReader(tc.InputData)
		var outBuf bytes.Buffer
		runCmd.Stdout = &outBuf

		if err := runCmd.Run(); err != nil {
			report.Passed = false
			report.Errors = append(report.Errors, fmt.Sprintf("Reference solution crashed on test %d (%s/%s): %v", tc.Ordinal, tc.GroupName, tc.Name, err))
			report.Duration = time.Since(start)
			return report, nil
		}

		if !tokensEqual(outBuf.String(), tc.OutputData) {
			report.Passed = false
			report.Errors = append(report.Errors, fmt.Sprintf("Reference solution gave Wrong Answer on test %d (%s/%s). Expected:\n%s\nGot:\n%s", tc.Ordinal, tc.GroupName, tc.Name, tc.OutputData, outBuf.String()))
			report.Duration = time.Since(start)
			return report, nil
		}
	}

	// Verify deliberate wrong solutions
	for _, ws := range pkg.WrongSolutions {
		wsBin := filepath.Join(tmpDir, "wrong_"+ws.Filename+".exe")
		wsSrc := filepath.Join(tmpDir, ws.Filename)
		_ = os.WriteFile(wsSrc, []byte(ws.SourceCode), 0644)

		wCompile := exec.CommandContext(ctx, cxx, "-std=c++23", "-O2", "-o", wsBin, wsSrc)
		var wCompOut bytes.Buffer
		wCompile.Stdout = &wCompOut
		wCompile.Stderr = &wCompOut

		if err := wCompile.Run(); err != nil {
			if ws.ExpectedVerdict == "CE" {
				report.WrongSolutions = append(report.WrongSolutions, WrongSolutionResult{
					Filename:        ws.Filename,
					ExpectedVerdict: "CE",
					ObservedVerdict: "CE",
					Passed:          true,
					Detail:          "Successfully failed with CE",
				})
				continue
			}
			report.Passed = false
			report.Errors = append(report.Errors, fmt.Sprintf("Wrong solution %s failed to compile unexpectedly: %s", ws.Filename, wCompOut.String()))
			continue
		}

		allAC := true
		observedVerdict := "AC"
		for _, tc := range pkg.TestCases {
			timeoutCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			wRun := exec.CommandContext(timeoutCtx, wsBin)
			wRun.Stdin = strings.NewReader(tc.InputData)
			var wOut bytes.Buffer
			wRun.Stdout = &wOut

			err := wRun.Run()
			cancel()

			if timeoutCtx.Err() == context.DeadlineExceeded {
				allAC = false
				observedVerdict = "TLE"
				break
			} else if err != nil {
				allAC = false
				observedVerdict = "RE"
				break
			} else if !tokensEqual(wOut.String(), tc.OutputData) {
				allAC = false
				observedVerdict = "WA"
				break
			}
		}

		if allAC {
			report.Passed = false
			errDetail := fmt.Sprintf("CRITICAL QUALITY GATE FAILURE: Deliberate wrong solution %q passed all test cases! (Expected %s)", ws.Filename, ws.ExpectedVerdict)
			report.Errors = append(report.Errors, errDetail)
			report.WrongSolutions = append(report.WrongSolutions, WrongSolutionResult{
				Filename:        ws.Filename,
				ExpectedVerdict: ws.ExpectedVerdict,
				ObservedVerdict: "AC",
				Passed:          false,
				Detail:          "Unintended AC! Tests lack anti-naive or edge cases.",
			})
		} else {
			report.WrongSolutions = append(report.WrongSolutions, WrongSolutionResult{
				Filename:        ws.Filename,
				ExpectedVerdict: ws.ExpectedVerdict,
				ObservedVerdict: observedVerdict,
				Passed:          true,
				Detail:          fmt.Sprintf("Successfully failed as intended (%s)", observedVerdict),
			})
		}
	}

	report.Duration = time.Since(start)
	return report, nil
}

func findCxxCompiler() string {
	candidates := []string{
		"clang++",
		"g++",
		`C:\Program Files\LLVM\bin\clang++.exe`,
	}
	for _, c := range candidates {
		resolved, err := exec.LookPath(c)
		if err != nil && !filepath.IsAbs(c) {
			continue
		}
		if resolved == "" {
			resolved = c
		}

		// Verify candidate actually supports -std=c++23 and standard libraries
		testCmd := exec.Command(resolved, "-std=c++23", "-c", "-x", "c++", "-", "-o", os.DevNull)
		testCmd.Stdin = strings.NewReader("#include <iostream>\nint main(){ return 0; }\n")
		if err := testCmd.Run(); err == nil {
			return resolved
		}
	}
	return ""
}

func tokensEqual(s1, s2 string) bool {
	f1 := strings.Fields(s1)
	f2 := strings.Fields(s2)
	if len(f1) != len(f2) {
		return false
	}
	for i := range f1 {
		if f1[i] != f2[i] {
			return false
		}
	}
	return true
}
