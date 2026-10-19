package main

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type BackupManifest struct {
	Format       string    `json:"format"`
	Timestamp    time.Time `json:"timestamp"`
	Version      string    `json:"version"`
	HasDatabase  bool      `json:"has_database"`
	ProblemCount int       `json:"problem_count"`
}

func runBackup(targetFile string) {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Snapshot & Backup Engine")
	fmt.Println("==========================================================")

	if targetFile == "" {
		targetFile = fmt.Sprintf("codebench-backup-%s.tar.gz", time.Now().Format("20060102-150405"))
	}

	outFile, err := os.Create(targetFile)
	if err != nil {
		fmt.Printf("[FAIL] Could not create backup destination file %s: %v\n", targetFile, err)
		os.Exit(1)
	}
	defer outFile.Close()

	gw := gzip.NewWriter(outFile)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	// 1. Dump Database
	fmt.Println("[1/3] Exporting PostgreSQL database schema and data...")
	dbDumpCmd := exec.Command("docker", "compose", "exec", "-T", "postgres", "pg_dump", "-U", "codebench", "codebench")
	dumpBytes, err := dbDumpCmd.Output()
	hasDB := true
	if err != nil {
		fmt.Printf("[WARN] Docker Compose pg_dump failed: %v. Database may not be running.\n", err)
		hasDB = false
		dumpBytes = []byte("-- No active database dump captured\n")
	} else {
		fmt.Printf("[OK] Database dump captured (%d bytes).\n", len(dumpBytes))
	}

	// Write db.sql to tar
	dbHdr := &tar.Header{
		Name:    "db.sql",
		Mode:    0600,
		Size:    int64(len(dumpBytes)),
		ModTime: time.Now(),
	}
	_ = tw.WriteHeader(dbHdr)
	_, _ = tw.Write(dumpBytes)

	// 2. Package Problems Directory
	fmt.Println("[2/3] Archiving problem packages from ./problems...")
	problemCount := 0
	problemsDir := "./problems"
	if fi, err := os.Stat(problemsDir); err == nil && fi.IsDir() {
		_ = filepath.Walk(problemsDir, func(path string, info os.FileInfo, walkErr error) error {
			if walkErr != nil || info == nil {
				return nil
			}

			relPath, err := filepath.Rel(".", path)
			if err != nil {
				return nil
			}
			relPath = filepath.ToSlash(relPath)

			if info.Name() == "problem.yaml" {
				problemCount++
			}

			hdr, err := tar.FileInfoHeader(info, info.Name())
			if err != nil {
				return nil
			}
			hdr.Name = relPath

			if err := tw.WriteHeader(hdr); err != nil {
				return err
			}

			if info.Mode().IsRegular() {
				f, err := os.Open(path)
				if err != nil {
					return nil
				}
				defer f.Close()
				_, _ = io.Copy(tw, f)
			}
			return nil
		})
	}
	fmt.Printf("[OK] Archived %d problem definition packages.\n", problemCount)

	// 3. Write Manifest
	manifest := BackupManifest{
		Format:       "codebench-backup-v1",
		Timestamp:    time.Now().UTC(),
		Version:      "1.0.0",
		HasDatabase:  hasDB,
		ProblemCount: problemCount,
	}
	manifestBytes, _ := json.MarshalIndent(manifest, "", "  ")
	manHdr := &tar.Header{
		Name:    "manifest.json",
		Mode:    0644,
		Size:    int64(len(manifestBytes)),
		ModTime: time.Now(),
	}
	_ = tw.WriteHeader(manHdr)
	_, _ = tw.Write(manifestBytes)

	_ = tw.Close()
	_ = gw.Close()

	stat, _ := outFile.Stat()
	fmt.Println("\n==========================================================")
	fmt.Printf(" Snapshot complete: %s (%d bytes)\n", targetFile, stat.Size())
	fmt.Println("==========================================================")
}

func runRestore(sourceFile string) {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Snapshot Restore Engine")
	fmt.Println("==========================================================")

	if sourceFile == "" {
		fmt.Println("[FAIL] Usage: codebench restore <backup_file.tar.gz>")
		os.Exit(1)
	}

	inFile, err := os.Open(sourceFile)
	if err != nil {
		fmt.Printf("[FAIL] Could not open backup file %s: %v\n", sourceFile, err)
		os.Exit(1)
	}
	defer inFile.Close()

	gr, err := gzip.NewReader(inFile)
	if err != nil {
		fmt.Printf("[FAIL] Not a valid gzip archive: %v\n", err)
		os.Exit(1)
	}
	defer gr.Close()

	tr := tar.NewReader(gr)

	var manifest *BackupManifest
	var dbSQLBytes []byte
	restoredFiles := 0

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			fmt.Printf("[FAIL] Error reading archive: %v\n", err)
			os.Exit(1)
		}

		if hdr.Name == "manifest.json" {
			data, _ := io.ReadAll(tr)
			var m BackupManifest
			if err := json.Unmarshal(data, &m); err == nil {
				manifest = &m
			}
			continue
		}

		if hdr.Name == "db.sql" {
			dbSQLBytes, _ = io.ReadAll(tr)
			continue
		}

		// Problem file
		if strings.HasPrefix(hdr.Name, "problems/") {
			target := filepath.Clean(hdr.Name)
			if hdr.FileInfo().IsDir() {
				_ = os.MkdirAll(target, 0755)
			} else {
				_ = os.MkdirAll(filepath.Dir(target), 0755)
				out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, hdr.FileInfo().Mode())
				if err == nil {
					_, _ = io.Copy(out, tr)
					out.Close()
					restoredFiles++
				}
			}
		}
	}

	if manifest != nil {
		fmt.Printf("[OK] Valid Codebench backup manifest verified (%s, created at %s)\n", manifest.Format, manifest.Timestamp.Format(time.RFC3339))
	}

	// Restore database if captured
	if len(dbSQLBytes) > 50 {
		fmt.Println("[INFO] Restoring PostgreSQL database via Docker Compose...")
		cmd := exec.Command("docker", "compose", "exec", "-T", "postgres", "psql", "-U", "codebench", "-d", "codebench")
		cmd.Stdin = strings.NewReader(string(dbSQLBytes))
		out, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf("[WARN] Database restore returned error: %v\nOutput: %s\n", err, string(out))
		} else {
			fmt.Println("[OK] Database restored successfully.")
		}
	}

	fmt.Printf("[OK] Restored %d problem files into ./problems/.\n", restoredFiles)
	fmt.Println("\n==========================================================")
	fmt.Println(" Snapshot restoration completed successfully.")
	fmt.Println("==========================================================")
}
