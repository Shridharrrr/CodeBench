package database

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/codebench/codebench/api/internal/models"
	"github.com/codebench/codebench/api/migrations"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, connString string) (*DB, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{pool: pool}
	if err := db.Migrate(ctx); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

func (db *DB) Close() {
	db.pool.Close()
}

func (db *DB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

func (db *DB) Migrate(ctx context.Context) error {
	slog.Info("Running PostgreSQL schema migrations...")
	_, err := db.pool.Exec(ctx, migrations.InitSchemaSQL)
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}
	slog.Info("PostgreSQL migrations applied successfully.")
	return nil
}

// CreateSubmissionTx atomically inserts a submission row and an outbox row in the same transaction
func (db *DB) CreateSubmissionTx(ctx context.Context, sub *models.Submission, jobPayload *models.JudgeJobPayload) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Insert Submission
	querySub := `
		INSERT INTO submissions (
			id, user_id, problem_version_id, contest_id, language, source_hash, source,
			status, verdict, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
		)
	`
	_, err = tx.Exec(ctx, querySub,
		sub.ID,
		sub.UserID,
		sub.ProblemVersionID,
		sub.ContestID,
		sub.Language,
		sub.SourceHash,
		sub.Source,
		sub.Status,
		sub.Verdict,
		sub.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert submission: %w", err)
	}

	// 2. Insert Outbox Row
	payloadJSON, err := json.Marshal(jobPayload)
	if err != nil {
		return fmt.Errorf("failed to marshal job payload: %w", err)
	}

	queryOutbox := `
		INSERT INTO outbox (
			id, subject, payload, created_at
		) VALUES (
			$1, $2, $3, $4
		)
	`
	outboxID := uuid.New()
	_, err = tx.Exec(ctx, queryOutbox, outboxID, "jobs.submissions", payloadJSON, sub.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert outbox row: %w", err)
	}

	return tx.Commit(ctx)
}

// FetchUnpublishedOutbox fetches unhandled outbox messages
func (db *DB) FetchUnpublishedOutbox(ctx context.Context, limit int) ([]models.OutboxEntry, error) {
	query := `
		SELECT id, subject, payload, created_at
		FROM outbox
		WHERE published_at IS NULL
		ORDER BY created_at ASC
		LIMIT $1
	`
	rows, err := db.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.OutboxEntry
	for rows.Next() {
		var e models.OutboxEntry
		var payloadJSON []byte
		if err := rows.Scan(&e.ID, &e.Subject, &payloadJSON, &e.CreatedAt); err != nil {
			return nil, err
		}
		var payloadMap map[string]any
		_ = json.Unmarshal(payloadJSON, &payloadMap)
		e.Payload = payloadMap
		entries = append(entries, e)
	}
	return entries, nil
}

// MarkOutboxPublished updates published_at
func (db *DB) MarkOutboxPublished(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE outbox SET published_at = NOW() WHERE id = $1`
	_, err := db.pool.Exec(ctx, query, id)
	return err
}

// SaveVerdictIdempotent records terminal verdict idempotently
func (db *DB) SaveVerdictIdempotent(ctx context.Context, vp *models.JudgeVerdictPayload) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	subID, err := uuid.Parse(vp.SubmissionID)
	if err != nil {
		return fmt.Errorf("invalid submission uuid: %w", err)
	}

	// Check existing submission status
	var currentVerdict string
	err = tx.QueryRow(ctx, "SELECT verdict FROM submissions WHERE id = $1 FOR UPDATE", subID).Scan(&currentVerdict)
	if err != nil {
		return fmt.Errorf("failed to select submission for verdict: %w", err)
	}

	// If already judged and terminal, acknowledge idempotently
	if currentVerdict != string(models.VerdictPending) {
		slog.Info("Submission already reached terminal verdict, skipping duplicate update", "submission_id", vp.SubmissionID, "verdict", currentVerdict)
		return tx.Commit(ctx)
	}

	// Update submission
	querySub := `
		UPDATE submissions SET
			status = $1,
			verdict = $2,
			time_ms = $3,
			memory_kb = $4,
			instructions = $5,
			failed_test = $6,
			failed_group = $7,
			compile_output = $8,
			complexity_report = $9,
			judge_host = $10,
			judged_at = NOW()
		WHERE id = $11
	`
	compReportJSON, _ := json.Marshal(vp.ComplexityReport)
	_, err = tx.Exec(ctx, querySub,
		vp.Status,
		vp.Verdict,
		vp.TotalTimeMS,
		vp.PeakMemoryKB,
		vp.TotalInstructions,
		vp.FailedTest,
		vp.FailedGroup,
		vp.CompileOutput,
		compReportJSON,
		vp.JudgeHost,
		subID,
	)
	if err != nil {
		return fmt.Errorf("failed to update submission verdict: %w", err)
	}

	// Insert test results
	for _, tr := range vp.TestResults {
		queryRes := `
			INSERT INTO submission_results (
				submission_id, ordinal, verdict, time_ms, memory_kb, instructions, diagnostic
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7
			)
		`
		_, err := tx.Exec(ctx, queryRes,
			subID,
			tr.Ordinal,
			tr.Verdict,
			tr.TimeMS,
			tr.MemoryKB,
			tr.Instructions,
			tr.Diagnostic,
		)
		if err != nil {
			return fmt.Errorf("failed to insert submission test result: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (db *DB) GetSubmission(ctx context.Context, id uuid.UUID) (*models.Submission, error) {
	query := `
		SELECT id, user_id, problem_version_id, contest_id, language, source_hash, source,
		       status, verdict, time_ms, memory_kb, instructions, failed_test, failed_group,
		       compile_output, judge_host, created_at, judged_at
		FROM submissions
		WHERE id = $1
	`
	var s models.Submission
	err := db.pool.QueryRow(ctx, query, id).Scan(
		&s.ID,
		&s.UserID,
		&s.ProblemVersionID,
		&s.ContestID,
		&s.Language,
		&s.SourceHash,
		&s.Source,
		&s.Status,
		&s.Verdict,
		&s.TimeMS,
		&s.MemoryKB,
		&s.Instructions,
		&s.FailedTest,
		&s.FailedGroup,
		&s.CompileOutput,
		&s.JudgeHost,
		&s.CreatedAt,
		&s.JudgedAt,
	)
	if err != nil {
		return nil, err
	}

	// Load results
	resQuery := `
		SELECT id, submission_id, test_id, ordinal, verdict, time_ms, memory_kb, instructions, diagnostic, created_at
		FROM submission_results
		WHERE submission_id = $1
		ORDER BY ordinal ASC
	`
	rows, err := db.pool.Query(ctx, resQuery, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var r models.SubmissionResult
			if err := rows.Scan(&r.ID, &r.SubmissionID, &r.TestID, &r.Ordinal, &r.Verdict, &r.TimeMS, &r.MemoryKB, &r.Instructions, &r.Diagnostic, &r.CreatedAt); err == nil {
				s.Results = append(s.Results, r)
			}
		}
	}

	return &s, nil
}

func (db *DB) GetProblemBySlug(ctx context.Context, slug string) (*models.Problem, *models.ProblemVersion, []models.TestCase, error) {
	var p models.Problem
	err := db.pool.QueryRow(ctx, "SELECT id, slug, owner_id, created_at FROM problems WHERE slug = $1", slug).
		Scan(&p.ID, &p.Slug, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		return nil, nil, nil, err
	}

	var pv models.ProblemVersion
	var compPolicyJSON []byte
	err = db.pool.QueryRow(ctx, `
		SELECT id, problem_id, version, title, statement_md, difficulty, tags,
		       time_limit_ms, memory_mb, checker_type, complexity_policy, package_hash, published_at
		FROM problem_versions
		WHERE problem_id = $1
		ORDER BY version DESC
		LIMIT 1
	`, p.ID).Scan(
		&pv.ID, &pv.ProblemID, &pv.Version, &pv.Title, &pv.StatementMD, &pv.Difficulty,
		&pv.Tags, &pv.TimeLimitMS, &pv.MemoryMB, &pv.CheckerType, &compPolicyJSON, &pv.PackageHash, &pv.PublishedAt,
	)
	if err != nil {
		return nil, nil, nil, err
	}
	_ = json.Unmarshal(compPolicyJSON, &pv.ComplexityPolicy)

	// Fetch test cases
	rows, err := db.pool.Query(ctx, `
		SELECT id, problem_version_id, group_name, ordinal, input_data, output_data, is_sample
		FROM test_cases
		WHERE problem_version_id = $1
		ORDER BY ordinal ASC
	`, pv.ID)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()

	var testCases []models.TestCase
	for rows.Next() {
		var tc models.TestCase
		if err := rows.Scan(&tc.ID, &tc.ProblemVersionID, &tc.GroupName, &tc.Ordinal, &tc.InputData, &tc.OutputData, &tc.IsSample); err == nil {
			testCases = append(testCases, tc)
		}
	}

	return &p, &pv, testCases, nil
}

func (db *DB) UpsertProblem(ctx context.Context, slug, title, statementMD, difficulty string, tags []string, timeLimitMS, memoryMB int, checkerType, packageHash string, complexityPolicy map[string]any, testCases []models.TestCase) (*models.Problem, *models.ProblemVersion, error) {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	var problemID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO problems (slug) VALUES ($1)
		ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
		RETURNING id
	`, slug).Scan(&problemID)
	if err != nil {
		return nil, nil, err
	}

	// Check if latest version already has identical package_hash
	var existingVersion int
	var existingHash string
	var existingPVID uuid.UUID
	checkErr := tx.QueryRow(ctx, "SELECT id, version, package_hash FROM problem_versions WHERE problem_id = $1 ORDER BY version DESC LIMIT 1", problemID).
		Scan(&existingPVID, &existingVersion, &existingHash)
	if checkErr == nil && existingHash == packageHash {
		// Already up to date with this exact content hash
		return &models.Problem{ID: problemID, Slug: slug}, &models.ProblemVersion{
			ID:               existingPVID,
			ProblemID:        problemID,
			Version:          existingVersion,
			Title:            title,
			StatementMD:      statementMD,
			Difficulty:       difficulty,
			Tags:             tags,
			TimeLimitMS:      timeLimitMS,
			MemoryMB:         memoryMB,
			CheckerType:      checkerType,
			ComplexityPolicy: complexityPolicy,
			PackageHash:      packageHash,
		}, nil
	}

	newVersion := existingVersion + 1

	compJSON, _ := json.Marshal(complexityPolicy)
	if compJSON == nil {
		compJSON = []byte("{}")
	}

	var pvID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO problem_versions (
			problem_id, version, title, statement_md, difficulty, tags,
			time_limit_ms, memory_mb, checker_type, complexity_policy, package_hash
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		) RETURNING id
	`, problemID, newVersion, title, statementMD, difficulty, tags, timeLimitMS, memoryMB, checkerType, compJSON, packageHash).Scan(&pvID)
	if err != nil {
		return nil, nil, err
	}

	for _, tc := range testCases {
		_, err := tx.Exec(ctx, `
			INSERT INTO test_cases (
				problem_version_id, group_name, ordinal, input_data, output_data, is_sample
			) VALUES ($1, $2, $3, $4, $5, $6)
		`, pvID, tc.GroupName, tc.Ordinal, tc.InputData, tc.OutputData, tc.IsSample)
		if err != nil {
			return nil, nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}

	return &models.Problem{ID: problemID, Slug: slug}, &models.ProblemVersion{
		ID:               pvID,
		ProblemID:        problemID,
		Version:          newVersion,
		Title:            title,
		StatementMD:      statementMD,
		Difficulty:       difficulty,
		Tags:             tags,
		TimeLimitMS:      timeLimitMS,
		MemoryMB:         memoryMB,
		CheckerType:      checkerType,
		ComplexityPolicy: complexityPolicy,
		PackageHash:      packageHash,
	}, nil
}

func (db *DB) UpsertAdminUser(ctx context.Context, name, email, passwordHash string) error {
	query := `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $2, $3, 'admin')
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
	`
	_, err := db.pool.Exec(ctx, query, name, email, passwordHash)
	return err
}

func (db *DB) ListProblems(ctx context.Context) ([]map[string]any, error) {
	query := `
		SELECT p.slug, pv.title, pv.difficulty, pv.tags, pv.time_limit_ms, pv.memory_mb
		FROM problems p
		JOIN problem_versions pv ON pv.problem_id = p.id
		WHERE pv.version = (SELECT MAX(v2.version) FROM problem_versions v2 WHERE v2.problem_id = p.id)
		ORDER BY p.slug ASC
	`
	rows, err := db.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]any
	for rows.Next() {
		var slug, title, diff string
		var tags []string
		var tl, mem int
		if err := rows.Scan(&slug, &title, &diff, &tags, &tl, &mem); err == nil {
			result = append(result, map[string]any{
				"slug":          slug,
				"title":         title,
				"difficulty":    diff,
				"tags":          tags,
				"time_limit_ms": tl,
				"memory_mb":     mem,
			})
		}
	}
	return result, nil
}

// User & Authentication queries

func (db *DB) CreateUser(ctx context.Context, name, email, passwordHash, role string) (*models.User, error) {
	if role == "" {
		role = "participant"
	}
	query := `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, email, role, created_at
	`
	var u models.User
	u.PasswordHash = passwordHash
	err := db.pool.QueryRow(ctx, query, name, email, passwordHash, role).Scan(
		&u.ID, &u.Name, &u.Email, &u.Role, &u.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *DB) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1`
	var u models.User
	err := db.pool.QueryRow(ctx, query, email).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *DB) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	query := `SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = $1`
	var u models.User
	err := db.pool.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// Session queries

func (db *DB) CreateSession(ctx context.Context, s *models.Session) error {
	query := `
		INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now().UTC()
	}
	_, err := db.pool.Exec(ctx, query, s.ID, s.UserID, s.TokenHash, s.CSRFToken, s.ExpiresAt, s.CreatedAt, s.UserAgent, s.IPAddress)
	return err
}

func (db *DB) GetSessionByTokenHash(ctx context.Context, tokenHash string) (*models.Session, *models.User, error) {
	query := `
		SELECT s.id, s.user_id, s.token_hash, s.csrf_token, s.expires_at, s.created_at, s.user_agent, s.ip_address,
		       u.id, u.name, u.email, u.password_hash, u.role, u.created_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > NOW()
	`
	var sess models.Session
	var u models.User
	err := db.pool.QueryRow(ctx, query, tokenHash).Scan(
		&sess.ID, &sess.UserID, &sess.TokenHash, &sess.CSRFToken, &sess.ExpiresAt, &sess.CreatedAt, &sess.UserAgent, &sess.IPAddress,
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt,
	)
	if err != nil {
		return nil, nil, err
	}
	return &sess, &u, nil
}

func (db *DB) DeleteSession(ctx context.Context, tokenHash string) error {
	query := `DELETE FROM sessions WHERE token_hash = $1`
	_, err := db.pool.Exec(ctx, query, tokenHash)
	return err
}

func (db *DB) DeleteUserSessions(ctx context.Context, userID uuid.UUID) error {
	query := `DELETE FROM sessions WHERE user_id = $1`
	_, err := db.pool.Exec(ctx, query, userID)
	return err
}

// Submission queries

func (db *DB) ListSubmissions(ctx context.Context, slug string, userID *uuid.UUID, verdict string, limit, offset int) ([]map[string]any, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	query := `
		SELECT s.id, s.user_id, u.name, p.slug, pv.title, s.language, s.status, s.verdict,
		       s.time_ms, s.memory_kb, s.instructions, s.created_at, s.judged_at
		FROM submissions s
		LEFT JOIN users u ON u.id = s.user_id
		JOIN problem_versions pv ON pv.id = s.problem_version_id
		JOIN problems p ON p.id = pv.problem_id
		WHERE ($1 = '' OR p.slug = $1)
		  AND ($2::uuid IS NULL OR s.user_id = $2)
		  AND ($3 = '' OR s.verdict = $3)
		ORDER BY s.created_at DESC
		LIMIT $4 OFFSET $5
	`
	rows, err := db.pool.Query(ctx, query, slug, userID, verdict, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]any, 0)
	for rows.Next() {
		var id uuid.UUID
		var subUserID *uuid.UUID
		var userName *string
		var pSlug, title, lang, status, verd string
		var timeMS, memKB, inst int64
		var createdAt time.Time
		var judgedAt *time.Time

		if err := rows.Scan(&id, &subUserID, &userName, &pSlug, &title, &lang, &status, &verd, &timeMS, &memKB, &inst, &createdAt, &judgedAt); err == nil {
			item := map[string]any{
				"id":            id,
				"user_id":       subUserID,
				"user_name":     userName,
				"problem_slug":  pSlug,
				"problem_title": title,
				"language":      lang,
				"status":        status,
				"verdict":       verd,
				"time_ms":       timeMS,
				"memory_kb":     memKB,
				"instructions":  inst,
				"created_at":    createdAt,
				"judged_at":     judgedAt,
			}
			list = append(list, item)
		}
	}
	return list, nil
}
