package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/codebench/codebench/pkg/auth"
	"github.com/jackc/pgx/v5"
)

func runAdminCommand() {
	if len(os.Args) < 3 {
		printAdminUsage()
		os.Exit(1)
	}

	subCmd := os.Args[2]
	switch subCmd {
	case "create":
		if len(os.Args) < 4 {
			fmt.Println("Usage: codebench admin create <email> [password]")
			os.Exit(1)
		}
		email := os.Args[3]
		password := ""
		if len(os.Args) > 4 {
			password = os.Args[4]
		}
		createOrResetAdmin(email, password)
	default:
		printAdminUsage()
		os.Exit(1)
	}
}

func printAdminUsage() {
	fmt.Println("Usage:")
	fmt.Println("  codebench admin create <email> [password]   Create or reset administrator credentials")
}

func createOrResetAdmin(email string, password string) {
	fmt.Println("==========================================================")
	fmt.Println("       Codebench Administrator Provisioning")
	fmt.Println("==========================================================")

	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || !strings.Contains(email, "@") {
		fmt.Printf("[FAIL] Invalid email address: %q\n", email)
		os.Exit(1)
	}

	generated := false
	if password == "" {
		randomBytes := make([]byte, 10)
		_, _ = rand.Read(randomBytes)
		password = hex.EncodeToString(randomBytes)
		generated = true
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		fmt.Printf("[FAIL] Failed to hash password with Argon2id: %v\n", err)
		os.Exit(1)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://codebench:codebench_dev_password@localhost:5432/codebench?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		// Try fallback to docker compose exec
		fmt.Println("[INFO] Direct PostgreSQL connection not available, attempting via Docker Compose...")
		execCmd := fmt.Sprintf(
			"INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', '%s', '%s', 'admin') "+
				"ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin';",
			email, hash,
		)
		cmd := exec.Command("docker", "compose", "exec", "-T", "postgres", "psql", "-U", "codebench", "-d", "codebench", "-c", execCmd)
		output, dockerErr := cmd.CombinedOutput()
		if dockerErr != nil {
			fmt.Printf("[FAIL] Could not update database via direct connection or Docker Compose: %v\nOutput: %s\n", dockerErr, string(output))
			os.Exit(1)
		}
	} else {
		defer conn.Close(ctx)
		query := `
			INSERT INTO users (name, email, password_hash, role)
			VALUES ('Admin', $1, $2, 'admin')
			ON CONFLICT (email) DO UPDATE
			SET password_hash = EXCLUDED.password_hash, role = 'admin'
		`
		if _, err := conn.Exec(ctx, query, email, hash); err != nil {
			fmt.Printf("[FAIL] Failed to execute database query: %v\n", err)
			os.Exit(1)
		}
	}

	fmt.Printf("[OK] Admin account successfully configured for: %s\n", email)
	if generated {
		fmt.Printf(">> Generated Password: %s\n", password)
		fmt.Println(">> IMPORTANT: Please record this password securely. It will not be shown again.")
	} else {
		fmt.Println("[OK] Provided password set successfully.")
	}
	fmt.Println("==========================================================")
}
