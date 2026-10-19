package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	tuneStateDir  = ".codebench"
	tuneStateFile = ".codebench/tune_state.json"
)

type TuneState struct {
	Timestamp     time.Time         `json:"timestamp"`
	HostOS        string            `json:"host_os"`
	PrevGovernors map[string]string `json:"prev_governors"`
	SwapDisabled  bool              `json:"swap_disabled"`
	PrevSMT       string            `json:"prev_smt,omitempty"`
}

func runTune(undo bool, autoConfirm bool) {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Host Tuning Engine (Grade A Timing)")
	fmt.Println("==========================================================")

	if runtime.GOOS != "linux" {
		fmt.Printf("\n[NOTICE] Host operating system is %s (Grade C: Development & Practice).\n", runtime.GOOS)
		fmt.Println("         Bare-metal CPU scaling governors, SMT controls, and kernel isolated cores")
		fmt.Println("         are managed by the hypervisor (WSL2 / Docker Desktop VM).")
		fmt.Println("         Direct host-level CPU tuning cannot be applied to this environment.")
		fmt.Println("\n         To deploy a Grade A / contest-grade host for microsecond-consistent timing:")
		fmt.Println("         1. Deploy Codebench on a dedicated native Linux host (Ubuntu 24.04 LTS recommended).")
		fmt.Println("         2. Run 'sudo ./codebench tune' directly on the bare-metal Linux host.")
		fmt.Println("==========================================================")
		return
	}

	if undo {
		revertHostTuning()
		return
	}

	applyHostTuning(autoConfirm)
}

func applyHostTuning(autoConfirm bool) {
	// Check root privileges
	if os.Geteuid() != 0 {
		fmt.Println("[WARN] Running without root privileges. Host tuning typically requires 'sudo ./codebench tune'.")
	}

	// 1. Inspect CPU Governors
	governorFiles, _ := filepath.Glob("/sys/devices/system/cpu/cpu*/cpufreq/scaling_governor")
	if len(governorFiles) == 0 {
		fmt.Println("[INFO] No cpufreq scaling_governor files detected.")
		fmt.Println("       Host may be running inside a virtualized container or fixed-clock environment.")
	}

	// 2. Check Swap
	swapData, _ := os.ReadFile("/proc/swaps")
	hasActiveSwap := false
	swapLines := strings.Split(strings.TrimSpace(string(swapData)), "\n")
	if len(swapLines) > 1 {
		hasActiveSwap = true
	}

	// 3. Check SMT
	smtControlFile := "/sys/devices/system/cpu/smt/control"
	currentSMT := "unknown"
	if smtBytes, err := os.ReadFile(smtControlFile); err == nil {
		currentSMT = strings.TrimSpace(string(smtBytes))
	}

	// 4. Check isolcpus in kernel cmdline
	cmdlineBytes, _ := os.ReadFile("/proc/cmdline")
	cmdline := string(cmdlineBytes)
	hasIsolcpus := strings.Contains(cmdline, "isolcpus")

	fmt.Printf("\nCurrent Host Baseline:\n")
	fmt.Printf("  CPU Cores with cpufreq: %d\n", len(governorFiles))
	fmt.Printf("  Active Swap Detected:   %v\n", hasActiveSwap)
	fmt.Printf("  SMT Control Status:     %s\n", currentSMT)
	fmt.Printf("  Kernel isolcpus Flag:   %v\n\n", hasIsolcpus)

	if !autoConfirm {
		fmt.Println("Proposed actions:")
		fmt.Println("  1. Switch CPU governors to 'performance' mode.")
		fmt.Println("  2. Disable swap ('swapoff -a') to prevent paging jitter.")
		fmt.Println("  3. Snapshot previous configuration to reversible state file.")
		fmt.Print("\nDo you wish to apply these tuning optimizations? [y/N]: ")
		reader := bufio.NewReader(os.Stdin)
		ans, _ := reader.ReadString('\n')
		ans = strings.TrimSpace(strings.ToLower(ans))
		if ans != "y" && ans != "yes" {
			fmt.Println("Tuning cancelled by user.")
			return
		}
	}

	state := TuneState{
		Timestamp:     time.Now(),
		HostOS:        runtime.GOOS,
		PrevGovernors: make(map[string]string),
		SwapDisabled:  false,
		PrevSMT:       currentSMT,
	}

	// Apply Governor = performance
	appliedGovernors := 0
	for _, f := range governorFiles {
		orig, err := os.ReadFile(f)
		if err == nil {
			prevGov := strings.TrimSpace(string(orig))
			state.PrevGovernors[f] = prevGov
			if prevGov != "performance" {
				if writeErr := os.WriteFile(f, []byte("performance\n"), 0644); writeErr == nil {
					appliedGovernors++
				} else {
					fmt.Printf("[WARN] Failed to write performance governor to %s: %v\n", f, writeErr)
				}
			}
		}
	}
	if appliedGovernors > 0 {
		fmt.Printf("[OK] Set 'performance' governor on %d CPU core(s).\n", appliedGovernors)
	}

	// Apply Swapoff
	if hasActiveSwap {
		cmd := exec.Command("swapoff", "-a")
		if err := cmd.Run(); err == nil {
			state.SwapDisabled = true
			fmt.Println("[OK] Swap disabled ('swapoff -a').")
		} else {
			fmt.Printf("[WARN] Failed to disable swap: %v\n", err)
		}
	}

	// Save tune state
	_ = os.MkdirAll(tuneStateDir, 0755)
	stateBytes, err := json.MarshalIndent(state, "", "  ")
	if err == nil {
		_ = os.WriteFile(tuneStateFile, stateBytes, 0600)
		fmt.Printf("[OK] Tuning state saved to %s (use './codebench tune --undo' to restore).\n", tuneStateFile)
	}

	// Recommendations
	fmt.Println("\nRecommended Next Steps for Full Grade A Certification:")
	if !hasIsolcpus {
		fmt.Println("  - Isolate CPU cores for the judge daemon:")
		fmt.Println("    Add 'isolcpus=2-7 nohz_full=2-7 rcu_nocbs=2-7' to GRUB_CMDLINE_LINUX in /etc/default/grub,")
		fmt.Println("    then run 'sudo update-grub' and reboot.")
	}
	if currentSMT == "on" {
		fmt.Println("  - SMT is currently enabled. For strict contest isolation, hyperthreads should be disabled:")
		fmt.Println("    Run: echo off | sudo tee /sys/devices/system/cpu/smt/control")
	}

	fmt.Println("\n==========================================================")
	fmt.Println(" Host tuning applied successfully.")
	fmt.Println("==========================================================")
}

func revertHostTuning() {
	stateBytes, err := os.ReadFile(tuneStateFile)
	if err != nil {
		fmt.Printf("[FAIL] No previous tune state found at %s. Nothing to undo.\n", tuneStateFile)
		return
	}

	var state TuneState
	if err := json.Unmarshal(stateBytes, &state); err != nil {
		fmt.Printf("[FAIL] Failed to parse tune state file: %v\n", err)
		return
	}

	fmt.Printf("Restoring configuration saved at %s...\n", state.Timestamp.Format(time.RFC3339))

	// Restore governors
	restoredGovernors := 0
	for path, prevGov := range state.PrevGovernors {
		if prevGov != "" {
			if err := os.WriteFile(path, []byte(prevGov+"\n"), 0644); err == nil {
				restoredGovernors++
			}
		}
	}
	if restoredGovernors > 0 {
		fmt.Printf("[OK] Restored original scaling governors on %d CPU core(s).\n", restoredGovernors)
	}

	// Restore swap
	if state.SwapDisabled {
		cmd := exec.Command("swapon", "-a")
		if err := cmd.Run(); err == nil {
			fmt.Println("[OK] Swap re-enabled ('swapon -a').")
		} else {
			fmt.Printf("[WARN] Failed to re-enable swap: %v\n", err)
		}
	}

	// Remove state file
	_ = os.Remove(tuneStateFile)
	fmt.Println("[OK] Removed tune state file.")

	fmt.Println("\n==========================================================")
	fmt.Println(" Host tuning restored to previous baseline.")
	fmt.Println("==========================================================")
}
