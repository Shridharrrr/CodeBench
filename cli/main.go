package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/codebench/codebench/pkg/problems"
)

func main() {
	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "doctor":
		runDoctor()
	case "up":
		runUp()
	case "dev":
		runDev()
	case "down":
		runDown()
	case "problems":
		runProblemsCommand()
	default:
		fmt.Printf("Usage: codebench {up|doctor|dev|down|problems {validate|import} <path>}\n")
		os.Exit(1)
	}
}

func runProblemsCommand() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: codebench problems {validate|import} <path>")
		os.Exit(1)
	}

	subCmd := os.Args[2]
	targetPath := "./problems"
	if len(os.Args) > 3 {
		targetPath = os.Args[3]
	}

	switch subCmd {
	case "validate":
		runProblemsValidate(targetPath)
	case "import":
		runProblemsImport(targetPath)
	default:
		fmt.Printf("Unknown problems command %q. Usage: codebench problems {validate|import} <path>\n", subCmd)
		os.Exit(1)
	}
}

func runProblemsValidate(targetPath string) {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Problem Package Validator")
	fmt.Println("==========================================================")

	fi, err := os.Stat(targetPath)
	if err != nil {
		fmt.Printf("[FAIL] Target path not found: %s\n", targetPath)
		os.Exit(1)
	}

	var dirsToValidate []string
	if fi.IsDir() {
		// Check if target is a single problem dir or a collection
		if _, err := os.Stat(filepath.Join(targetPath, "problem.yaml")); err == nil {
			dirsToValidate = append(dirsToValidate, targetPath)
		} else {
			entries, _ := os.ReadDir(targetPath)
			for _, e := range entries {
				if e.IsDir() {
					p := filepath.Join(targetPath, e.Name())
					if _, err := os.Stat(filepath.Join(p, "problem.yaml")); err == nil {
						dirsToValidate = append(dirsToValidate, p)
					}
				}
			}
		}
	} else {
		fmt.Printf("[FAIL] Target must be a directory: %s\n", targetPath)
		os.Exit(1)
	}

	if len(dirsToValidate) == 0 {
		fmt.Printf("[FAIL] No valid problem packages (containing problem.yaml) found in %s\n", targetPath)
		os.Exit(1)
	}

	allPassed := true
	ctx := context.Background()

	for _, dir := range dirsToValidate {
		fmt.Printf("\n--- Validating: %s ---\n", dir)
		pkg, err := problems.LoadPackage(dir)
		if err != nil {
			fmt.Printf("[FAIL] Failed to load package: %v\n", err)
			allPassed = false
			continue
		}

		fmt.Printf("  Slug:        %s (version %d)\n", pkg.Manifest.Slug, pkg.Manifest.Version)
		fmt.Printf("  Title:       %s\n", pkg.Manifest.Title)
		fmt.Printf("  Difficulty:  %s | Checker: %s\n", pkg.Manifest.Difficulty, pkg.Manifest.Checker.Type)
		fmt.Printf("  Limits:      %d ms / %d MB\n", pkg.Manifest.Limits.TimeLimitMS, pkg.Manifest.Limits.MemoryLimitMB)
		fmt.Printf("  PackageHash: %s...\n", pkg.CanonicalHash[:16])
		fmt.Printf("  Test cases:  %d total\n", len(pkg.TestCases))

		report, err := problems.ValidatePackage(ctx, pkg)
		if err != nil {
			fmt.Printf("[FAIL] Validation execution error: %v\n", err)
			allPassed = false
			continue
		}

		if report.Passed {
			fmt.Printf("[OK] Reference solution verified (AC on all tests)\n")
			for _, ws := range report.WrongSolutions {
				fmt.Printf("[OK] Wrong solution %q correctly failed (%s -> %s)\n", ws.Filename, ws.ExpectedVerdict, ws.ObservedVerdict)
			}
			fmt.Printf(">> RESULT: PASSED (completed in %v)\n", report.Duration.Round(time.Millisecond))
		} else {
			allPassed = false
			fmt.Printf("[FAIL] Validation failed with errors:\n")
			for _, e := range report.Errors {
				fmt.Printf("       - %s\n", e)
			}
		}
	}

	fmt.Println("\n==========================================================")
	if allPassed {
		fmt.Printf(" All %d problem package(s) passed validation successfully!\n", len(dirsToValidate))
		fmt.Println("==========================================================")
	} else {
		fmt.Println(" Some problem package(s) failed validation.")
		fmt.Println("==========================================================")
		os.Exit(1)
	}
}

func runProblemsImport(targetPath string) {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Problem Package Importer")
	fmt.Println("==========================================================")

	apiURL := os.Getenv("CODEBENCH_API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:8080"
	}

	reqBody, _ := json.Marshal(map[string]string{"path": targetPath})
	resp, err := http.Post(apiURL+"/api/problems/import", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		fmt.Printf("[FAIL] Could not connect to Codebench API at %s: %v\n", apiURL, err)
		fmt.Println("       Make sure Codebench services are running (run './codebench up').")
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("[FAIL] Import failed with HTTP %d: %s\n", resp.StatusCode, string(bodyBytes))
		os.Exit(1)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	var singleResult struct {
		Slug        string `json:"slug"`
		Version     int    `json:"version"`
		TestCount   int    `json:"test_count"`
		PackageHash string `json:"package_hash"`
	}
	if err := json.Unmarshal(bodyBytes, &singleResult); err == nil && singleResult.Slug != "" {
		fmt.Printf("[OK] Imported problem %q (version %d) with %d test cases [hash: %s...]\n",
			singleResult.Slug, singleResult.Version, singleResult.TestCount, singleResult.PackageHash[:12])
	} else {
		var multiResults []struct {
			Slug        string `json:"slug"`
			Version     int    `json:"version"`
			TestCount   int    `json:"test_count"`
			PackageHash string `json:"package_hash"`
		}
		_ = json.Unmarshal(bodyBytes, &multiResults)
		for _, res := range multiResults {
			fmt.Printf("[OK] Imported problem %q (version %d) with %d test cases [hash: %s...]\n",
				res.Slug, res.Version, res.TestCount, res.PackageHash[:12])
		}
	}
	fmt.Println("\nImport complete.")
}

func runDoctor() bool {
	fmt.Println("===========================================")
	fmt.Println("      Codebench System Doctor & Preflight  ")
	fmt.Println("===========================================")

	allOk := true

	// 1. Docker Installed
	dockerPath, err := exec.LookPath("docker")
	if err != nil {
		fmt.Println("[FAIL] Docker is not installed or not in PATH.")
		fmt.Println("       Fix: Install Docker Desktop (https://www.docker.com/products/docker-desktop)")
		allOk = false
	} else {
		out, _ := exec.Command(dockerPath, "--version").Output()
		fmt.Printf("[OK] Docker is installed (%s)\n", strings.TrimSpace(string(out)))
	}

	// 2. Docker Daemon Running
	if dockerPath != "" {
		err := exec.Command(dockerPath, "info").Run()
		if err != nil {
			fmt.Println("[FAIL] Docker daemon is not running.")
			fmt.Println("       Fix: Start Docker Desktop from your applications menu.")
			allOk = false
		} else {
			fmt.Println("[OK] Docker daemon is running.")
		}
	}

	// 3. Docker Compose
	if dockerPath != "" {
		out, err := exec.Command(dockerPath, "compose", "version", "--short").Output()
		if err != nil {
			fmt.Println("[FAIL] Docker Compose plugin is not working.")
			allOk = false
		} else {
			fmt.Printf("[OK] Docker Compose is available (%s)\n", strings.TrimSpace(string(out)))
		}
	}

	// 4. Ports Check
	ports := []int{8080, 5432, 4222}
	for _, p := range ports {
		addr := fmt.Sprintf("127.0.0.1:%d", p)
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			conn.Close()
			fmt.Printf("[WARN] Port %d is currently in use.\n", p)
		} else {
			fmt.Printf("[OK] Port %d is available.\n", p)
		}
	}

	// 5. Timing Grade
	fmt.Println("\nEvaluating Timing-Quality Grade:")
	switch runtime.GOOS {
	case "linux":
		if _, err := os.Stat("/sys/fs/cgroup/cgroup.controllers"); err == nil {
			fmt.Println(">> Host: Linux (cgroups v2 available)")
			fmt.Println(">> TIMING GRADE: Grade B (Default Scheduling)")
			fmt.Println("   Tip: Run './codebench tune' on dedicated bare-metal to achieve Grade A.")
		} else {
			fmt.Println(">> Host: Linux (Containerized / WSL)")
			fmt.Println(">> TIMING GRADE: Grade C (Development & Practice)")
		}
	case "windows":
		fmt.Println(">> Host: Windows (Docker Desktop / WSL2)")
		fmt.Println(">> TIMING GRADE: Grade C (Development & Practice)")
		fmt.Println("   Notice: Hypervisor virtualization adds timing jitter; suitable for dev & practice.")
	case "darwin":
		fmt.Println(">> Host: macOS (Docker Desktop)")
		fmt.Println(">> TIMING GRADE: Grade C (Development & Practice)")
	default:
		fmt.Printf(">> Host: %s\n>> TIMING GRADE: Grade C\n", runtime.GOOS)
	}

	fmt.Println("\nDoctor check complete.")
	return allOk
}

func runUp() {
	if !runDoctor() {
		fmt.Println("\nDoctor preflight checks failed. Please resolve above items before running.")
		os.Exit(1)
	}

	fmt.Println("\nStarting Codebench with Docker Compose...")
	cmd := exec.Command("docker", "compose", "up", "-d", "--build")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Printf("Failed to run docker compose: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\n==========================================================")
	fmt.Println(" Codebench is running!")
	fmt.Println(" Web UI & API:        http://localhost:8080")
	fmt.Println(" Default Admin User:  admin@codebench.local")
	fmt.Println(" Default Password:    codebench123")
	fmt.Println("==========================================================")
}

func runDev() {
	fmt.Println("Starting Codebench in development mode...")
	cmd := exec.Command("docker", "compose", "-f", "compose.yaml", "-f", "compose.dev.yaml", "up", "--build")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	_ = cmd.Run()
}

func runDown() {
	fmt.Println("Stopping Codebench services...")
	cmd := exec.Command("docker", "compose", "down")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	_ = cmd.Run()
}
