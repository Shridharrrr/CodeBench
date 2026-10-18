package main

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
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
	default:
		fmt.Printf("Usage: codebench {up|doctor|dev|down}\n")
		os.Exit(1)
	}
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
