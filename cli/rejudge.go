package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type RejudgeRequest struct {
	ScopeType string `json:"scope_type"`
	ScopeID   string `json:"scope_id"`
}

type RejudgeResponse struct {
	BatchID     string `json:"batch_id"`
	ScopeType   string `json:"scope_type"`
	ScopeID     string `json:"scope_id"`
	QueuedCount int    `json:"queued_count"`
	Status      string `json:"status"`
	Message     string `json:"message,omitempty"`
}

func runRejudgeCommand() {
	if len(os.Args) < 4 {
		printRejudgeUsage()
		os.Exit(1)
	}

	scopeFlag := os.Args[2]
	scopeID := os.Args[3]

	var scopeType string
	switch scopeFlag {
	case "--submission", "-s":
		scopeType = "submission"
	case "--problem", "-p":
		scopeType = "problem_version"
	case "--contest", "-c":
		scopeType = "contest"
	default:
		printRejudgeUsage()
		os.Exit(1)
	}

	fmt.Println("==========================================================")
	fmt.Println("       Codebench Batch Rejudge Operations")
	fmt.Println("==========================================================")
	fmt.Printf("Submitting rejudge request for %s %q...\n", scopeType, scopeID)

	apiURL := os.Getenv("CODEBENCH_API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:8080"
	}

	reqBody, _ := json.Marshal(RejudgeRequest{
		ScopeType: scopeType,
		ScopeID:   scopeID,
	})

	resp, err := http.Post(apiURL+"/api/admin/rejudge", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		fmt.Printf("[FAIL] Could not connect to Codebench API at %s: %v\n", apiURL, err)
		fmt.Println("       Ensure Codebench services are running ('./codebench up').")
		os.Exit(1)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		fmt.Printf("[FAIL] Rejudge request rejected (HTTP %d): %s\n", resp.StatusCode, string(bodyBytes))
		os.Exit(1)
	}

	var res RejudgeResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		fmt.Printf("[WARN] Unmarshal warning: %v\nRaw response: %s\n", err, string(bodyBytes))
	} else {
		fmt.Printf("[OK] Batch Rejudge initiated successfully!\n")
		fmt.Printf("  Batch ID:     %s\n", res.BatchID)
		fmt.Printf("  Scope:        %s (%s)\n", res.ScopeType, res.ScopeID)
		fmt.Printf("  Queued Count: %d submission(s)\n", res.QueuedCount)
		fmt.Printf("  Status:       %s\n", res.Status)
	}
	fmt.Println("==========================================================")
}

func printRejudgeUsage() {
	fmt.Println("Usage:")
	fmt.Println("  codebench rejudge --submission <submission_id>   Rejudge a single submission")
	fmt.Println("  codebench rejudge --problem <problem_version_id> Rejudge all submissions for problem version")
	fmt.Println("  codebench rejudge --contest <contest_id>         Rejudge all submissions in a contest")
}
