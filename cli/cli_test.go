package main

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestDoctorRunsWithoutPanic(t *testing.T) {
	// runDoctor should complete and return a boolean
	_ = runDoctor()
}

func TestHostTuningNonLinuxSafeguard(t *testing.T) {
	if runtime.GOOS == "linux" {
		t.Skip("Skipping non-Linux test on Linux environment")
	}

	// On non-Linux (windows/darwin), runTune should safely notify without error or panic
	runTune(false, true)
	runTune(true, true)
}

func TestBackupAndRestoreArchiveIntegrity(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-backup-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	backupFile := filepath.Join(tempDir, "test-backup.tar.gz")

	// Create backup
	runBackup(backupFile)

	// Verify file was created
	fi, err := os.Stat(backupFile)
	if err != nil || fi.Size() == 0 {
		t.Fatalf("Backup file not created or empty: %v", err)
	}

	// Verify archive contains manifest.json and db.sql
	f, err := os.Open(backupFile)
	if err != nil {
		t.Fatalf("Failed to open backup: %v", err)
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatalf("Failed to create gzip reader: %v", err)
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	foundManifest := false
	foundDBSQL := false

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("Error reading tar archive: %v", err)
		}

		if hdr.Name == "manifest.json" {
			foundManifest = true
			data, _ := io.ReadAll(tr)
			var m BackupManifest
			if err := json.Unmarshal(data, &m); err != nil {
				t.Errorf("Invalid manifest JSON: %v", err)
			}
			if m.Format != "codebench-backup-v1" {
				t.Errorf("Unexpected manifest format: %s", m.Format)
			}
		}
		if hdr.Name == "db.sql" {
			foundDBSQL = true
		}
	}

	if !foundManifest {
		t.Errorf("Expected manifest.json in backup archive")
	}
	if !foundDBSQL {
		t.Errorf("Expected db.sql in backup archive")
	}

	// Test restore
	runRestore(backupFile)
}

func TestLANIPDetection(t *testing.T) {
	ip := detectHostLANIP()
	if ip == "" {
		t.Errorf("Expected non-empty detected LAN IP")
	}
}

func TestTuneStateSerialization(t *testing.T) {
	state := TuneState{
		Timestamp: time.Now(),
		HostOS:    "linux",
		PrevGovernors: map[string]string{
			"/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor": "powersave",
			"/sys/devices/system/cpu/cpu1/cpufreq/scaling_governor": "powersave",
		},
		SwapDisabled: true,
		PrevSMT:      "on",
	}

	data, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("Failed to marshal tune state: %v", err)
	}

	var parsed TuneState
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal tune state: %v", err)
	}

	if len(parsed.PrevGovernors) != 2 {
		t.Errorf("Expected 2 governors, got %d", len(parsed.PrevGovernors))
	}
	if !parsed.SwapDisabled {
		t.Errorf("Expected swap disabled to be true")
	}
	if parsed.PrevSMT != "on" {
		t.Errorf("Expected PrevSMT to be 'on', got %s", parsed.PrevSMT)
	}
}
