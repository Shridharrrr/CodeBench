package database

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
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
	return db.InsertSubmissionWithOutbox(ctx, sub, jobPayload)
}

// InsertSubmissionWithOutbox inserts a submission and its corresponding outbox row within a transaction,
// automatically routing to the priority lane for contest submissions, or standard lane for practice.
func (db *DB) InsertSubmissionWithOutbox(ctx context.Context, sub *models.Submission, jobPayload any) error {
	lane := "standard"
	if sub.ContestID != nil {
		lane = "priority"
	}
	return db.InsertSubmissionWithOutboxLane(ctx, sub, jobPayload, lane)
}

// InsertSubmissionWithOutboxLane inserts a submission and outbox row directed to a specific priority lane
func (db *DB) InsertSubmissionWithOutboxLane(ctx context.Context, sub *models.Submission, jobPayload any, lane string) error {
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

	subject := "jobs.submissions." + lane
	if lane == "" {
		subject = "jobs.submissions"
	}

	queryOutbox := `
		INSERT INTO outbox (
			id, subject, payload, created_at
		) VALUES (
			$1, $2, $3, $4
		)
	`
	outboxID := uuid.New()
	_, err = tx.Exec(ctx, queryOutbox, outboxID, subject, payloadJSON, sub.CreatedAt)
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
		       compile_output, complexity_report, judge_host, created_at, judged_at
		FROM submissions
		WHERE id = $1
	`
	var s models.Submission
	var compJSON []byte
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
		&compJSON,
		&s.JudgeHost,
		&s.CreatedAt,
		&s.JudgedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(compJSON) > 0 {
		_ = json.Unmarshal(compJSON, &s.ComplexityReport)
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

func (db *DB) GetProblemVersionByID(ctx context.Context, id uuid.UUID) (*models.ProblemVersion, error) {
	query := `
		SELECT id, problem_id, version, title, statement_md, difficulty, tags,
		       time_limit_ms, memory_mb, checker_type, complexity_policy, package_hash, published_at
		FROM problem_versions
		WHERE id = $1
	`
	var pv models.ProblemVersion
	var compJSON []byte
	err := db.pool.QueryRow(ctx, query, id).Scan(
		&pv.ID,
		&pv.ProblemID,
		&pv.Version,
		&pv.Title,
		&pv.StatementMD,
		&pv.Difficulty,
		&pv.Tags,
		&pv.TimeLimitMS,
		&pv.MemoryMB,
		&pv.CheckerType,
		&compJSON,
		&pv.PackageHash,
		&pv.PublishedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(compJSON) > 0 {
		_ = json.Unmarshal(compJSON, &pv.ComplexityPolicy)
	}
	return &pv, nil
}

func (db *DB) GetTestCasesByVersionID(ctx context.Context, versionID uuid.UUID) ([]models.TestCase, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT id, problem_version_id, group_name, ordinal, input_data, output_data, is_sample
		FROM test_cases
		WHERE problem_version_id = $1
		ORDER BY ordinal ASC
	`, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var testCases []models.TestCase
	for rows.Next() {
		var tc models.TestCase
		if err := rows.Scan(&tc.ID, &tc.ProblemVersionID, &tc.GroupName, &tc.Ordinal, &tc.InputData, &tc.OutputData, &tc.IsSample); err == nil {
			testCases = append(testCases, tc)
		}
	}
	return testCases, nil
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

// Contest queries

func (db *DB) CreateContest(ctx context.Context, c *models.Contest, problems []models.ContestProblem) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.CreatedAt.IsZero() {
		c.CreatedAt = time.Now().UTC()
	}

	queryContest := `
		INSERT INTO contests (id, title, mode, starts_at, ends_at, freeze_at, scoring, owner_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err = tx.Exec(ctx, queryContest, c.ID, c.Title, c.Mode, c.StartsAt, c.EndsAt, c.FreezeAt, c.Scoring, c.OwnerID, c.CreatedAt)
	if err != nil {
		return err
	}

	for _, p := range problems {
		queryProb := `
			INSERT INTO contest_problems (contest_id, problem_version_id, label, points)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (contest_id, problem_version_id) DO UPDATE SET label = EXCLUDED.label, points = EXCLUDED.points
		`
		if _, err := tx.Exec(ctx, queryProb, c.ID, p.ProblemVersionID, p.Label, p.Points); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (db *DB) GetContest(ctx context.Context, id uuid.UUID) (*models.Contest, error) {
	query := `
		SELECT id, title, mode, starts_at, ends_at, freeze_at, scoring, owner_id, created_at
		FROM contests
		WHERE id = $1
	`
	var c models.Contest
	err := db.pool.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.Title, &c.Mode, &c.StartsAt, &c.EndsAt, &c.FreezeAt, &c.Scoring, &c.OwnerID, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (db *DB) ListContests(ctx context.Context, mode string) ([]models.Contest, error) {
	query := `
		SELECT id, title, mode, starts_at, ends_at, freeze_at, scoring, owner_id, created_at
		FROM contests
		WHERE ($1 = '' OR mode = $1)
		ORDER BY starts_at DESC
	`
	rows, err := db.pool.Query(ctx, query, mode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Contest, 0)
	for rows.Next() {
		var c models.Contest
		if err := rows.Scan(&c.ID, &c.Title, &c.Mode, &c.StartsAt, &c.EndsAt, &c.FreezeAt, &c.Scoring, &c.OwnerID, &c.CreatedAt); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}

func (db *DB) JoinContest(ctx context.Context, contestID, userID uuid.UUID) error {
	query := `
		INSERT INTO participants (contest_id, user_id, joined_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (contest_id, user_id) DO NOTHING
	`
	_, err := db.pool.Exec(ctx, query, contestID, userID)
	return err
}

func (db *DB) IsParticipant(ctx context.Context, contestID, userID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM participants WHERE contest_id = $1 AND user_id = $2)`
	err := db.pool.QueryRow(ctx, query, contestID, userID).Scan(&exists)
	return exists, err
}

func (db *DB) GetContestProblems(ctx context.Context, contestID uuid.UUID) ([]models.ContestProblem, error) {
	query := `
		SELECT cp.contest_id, cp.problem_version_id, cp.label, cp.points, pv.title, p.slug, pv.difficulty
		FROM contest_problems cp
		JOIN problem_versions pv ON pv.id = cp.problem_version_id
		JOIN problems p ON p.id = pv.problem_id
		WHERE cp.contest_id = $1
		ORDER BY cp.label ASC
	`
	rows, err := db.pool.Query(ctx, query, contestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.ContestProblem, 0)
	for rows.Next() {
		var cp models.ContestProblem
		if err := rows.Scan(&cp.ContestID, &cp.ProblemVersionID, &cp.Label, &cp.Points, &cp.Title, &cp.Slug, &cp.Difficulty); err == nil {
			list = append(list, cp)
		}
	}
	return list, nil
}

func (db *DB) GetContestProblemByLabel(ctx context.Context, contestID uuid.UUID, label string) (*models.ContestProblem, *models.ProblemVersion, []models.TestCase, error) {
	query := `
		SELECT cp.contest_id, cp.problem_version_id, cp.label, cp.points, pv.title, p.slug, pv.difficulty,
		       pv.statement_md, pv.time_limit_ms, pv.memory_mb, pv.checker_type, pv.version, pv.package_hash, pv.published_at
		FROM contest_problems cp
		JOIN problem_versions pv ON pv.id = cp.problem_version_id
		JOIN problems p ON p.id = pv.problem_id
		WHERE cp.contest_id = $1 AND UPPER(cp.label) = UPPER($2)
	`
	var cp models.ContestProblem
	var pv models.ProblemVersion
	err := db.pool.QueryRow(ctx, query, contestID, label).Scan(
		&cp.ContestID, &cp.ProblemVersionID, &cp.Label, &cp.Points, &cp.Title, &cp.Slug, &cp.Difficulty,
		&pv.StatementMD, &pv.TimeLimitMS, &pv.MemoryMB, &pv.CheckerType, &pv.Version, &pv.PackageHash, &pv.PublishedAt,
	)
	if err != nil {
		return nil, nil, nil, err
	}
	pv.ID = cp.ProblemVersionID
	pv.Title = cp.Title

	// Fetch test cases
	tcRows, err := db.pool.Query(ctx, `
		SELECT id, problem_version_id, group_name, ordinal, input_data, output_data, is_sample
		FROM test_cases
		WHERE problem_version_id = $1
		ORDER BY ordinal ASC
	`, pv.ID)
	if err != nil {
		return nil, nil, nil, err
	}
	defer tcRows.Close()

	var testCases []models.TestCase
	for tcRows.Next() {
		var tc models.TestCase
		if err := tcRows.Scan(&tc.ID, &tc.ProblemVersionID, &tc.GroupName, &tc.Ordinal, &tc.InputData, &tc.OutputData, &tc.IsSample); err == nil {
			testCases = append(testCases, tc)
		}
	}

	return &cp, &pv, testCases, nil
}

func (db *DB) GetContestParticipants(ctx context.Context, contestID uuid.UUID) ([]models.Participant, error) {
	query := `
		SELECT p.contest_id, p.user_id, u.name, u.email, p.joined_at
		FROM participants p
		JOIN users u ON u.id = p.user_id
		WHERE p.contest_id = $1
		ORDER BY p.joined_at ASC
	`
	rows, err := db.pool.Query(ctx, query, contestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Participant, 0)
	for rows.Next() {
		var p models.Participant
		if err := rows.Scan(&p.ContestID, &p.UserID, &p.UserName, &p.UserEmail, &p.JoinedAt); err == nil {
			list = append(list, p)
		}
	}
	return list, nil
}

func (db *DB) GetContestSubmissions(ctx context.Context, contestID uuid.UUID) ([]models.Submission, error) {
	query := `
		SELECT id, user_id, problem_version_id, contest_id, language, source_hash, source,
		       status, verdict, time_ms, memory_kb, instructions, failed_test, failed_group,
		       compile_output, judge_host, created_at, judged_at
		FROM submissions
		WHERE contest_id = $1
		ORDER BY created_at ASC
	`
	rows, err := db.pool.Query(ctx, query, contestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Submission, 0)
	for rows.Next() {
		var s models.Submission
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.ProblemVersionID, &s.ContestID, &s.Language, &s.SourceHash, &s.Source,
			&s.Status, &s.Verdict, &s.TimeMS, &s.MemoryKB, &s.Instructions, &s.FailedTest, &s.FailedGroup,
			&s.CompileOutput, &s.JudgeHost, &s.CreatedAt, &s.JudgedAt,
		); err == nil {
			list = append(list, s)
		}
	}
	return list, nil
}

func (db *DB) GetUserSolvedProblemVersionIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT problem_version_id
		FROM submissions
		WHERE user_id = $1 AND verdict = 'AC'
	`
	rows, err := db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

type PracticeCandidate struct {
	ProblemVersion models.ProblemVersion
	Slug           string
}

func (db *DB) GetPracticeEligibleProblems(ctx context.Context, difficulty string, tags []string, excludeVersionIDs []uuid.UUID) ([]PracticeCandidate, error) {
	query := `
		SELECT pv.id, pv.problem_id, pv.version, pv.title, pv.statement_md, pv.difficulty,
		       pv.tags, pv.time_limit_ms, pv.memory_mb, pv.checker_type, pv.complexity_policy,
		       pv.package_hash, p.slug
		FROM problem_versions pv
		JOIN problems p ON p.id = pv.problem_id
		WHERE pv.version = (SELECT MAX(v2.version) FROM problem_versions v2 WHERE v2.problem_id = p.id)
	`
	args := []any{}
	argIdx := 1

	if difficulty != "" && strings.ToUpper(difficulty) != "ANY" {
		query += fmt.Sprintf(" AND UPPER(pv.difficulty) = UPPER($%d)", argIdx)
		args = append(args, difficulty)
		argIdx++
	}

	if len(tags) > 0 {
		query += fmt.Sprintf(" AND pv.tags && $%d", argIdx)
		args = append(args, tags)
		argIdx++
	}

	if len(excludeVersionIDs) > 0 {
		query += fmt.Sprintf(" AND NOT (pv.id = ANY($%d))", argIdx)
		args = append(args, excludeVersionIDs)
		argIdx++
	}

	query += " ORDER BY p.slug ASC"

	rows, err := db.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []PracticeCandidate
	for rows.Next() {
		var c PracticeCandidate
		var compJSON []byte
		if err := rows.Scan(
			&c.ProblemVersion.ID,
			&c.ProblemVersion.ProblemID,
			&c.ProblemVersion.Version,
			&c.ProblemVersion.Title,
			&c.ProblemVersion.StatementMD,
			&c.ProblemVersion.Difficulty,
			&c.ProblemVersion.Tags,
			&c.ProblemVersion.TimeLimitMS,
			&c.ProblemVersion.MemoryMB,
			&c.ProblemVersion.CheckerType,
			&compJSON,
			&c.ProblemVersion.PackageHash,
			&c.Slug,
		); err == nil {
			if len(compJSON) > 0 {
				_ = json.Unmarshal(compJSON, &c.ProblemVersion.ComplexityPolicy)
			}
			candidates = append(candidates, c)
		}
	}
	return candidates, nil
}

func (db *DB) GetUserPracticeContests(ctx context.Context, userID uuid.UUID) ([]models.Contest, error) {
	query := `
		SELECT id, title, mode, starts_at, ends_at, freeze_at, scoring, owner_id, created_at
		FROM contests
		WHERE mode = 'practice' AND owner_id = $1
		ORDER BY created_at DESC
	`
	rows, err := db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Contest
	for rows.Next() {
		var c models.Contest
		if err := rows.Scan(
			&c.ID, &c.Title, &c.Mode, &c.StartsAt, &c.EndsAt, &c.FreezeAt, &c.Scoring, &c.OwnerID, &c.CreatedAt,
		); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}

// -------------------------------------------------------------
// Phase 7: Rejudge Batches, Stale-Job Sweeper, and Observability
// -------------------------------------------------------------

// CreateRejudgeBatch records a new administrative batch rejudge
func (db *DB) CreateRejudgeBatch(ctx context.Context, scope models.RejudgeScope, requestedBy *uuid.UUID) (*models.RejudgeBatch, error) {
	scopeJSON, err := json.Marshal(scope)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal scope: %w", err)
	}

	batch := &models.RejudgeBatch{
		ID:          uuid.New(),
		Scope:       scope,
		RequestedBy: requestedBy,
		CreatedAt:   time.Now().UTC(),
	}

	query := `
		INSERT INTO rejudge_batches (id, scope, requested_by, created_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err = db.pool.Exec(ctx, query, batch.ID, scopeJSON, batch.RequestedBy, batch.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert rejudge batch: %w", err)
	}

	return batch, nil
}

// GetSubmissionsForRejudge fetches all submissions matching the target rejudge scope
func (db *DB) GetSubmissionsForRejudge(ctx context.Context, scope models.RejudgeScope) ([]models.Submission, error) {
	var query string
	var args []any

	switch scope.Type {
	case models.RejudgeScopeSubmission:
		query = `
			SELECT id, user_id, problem_version_id, contest_id, language, source_hash, source,
			       status, verdict, created_at
			FROM submissions
			WHERE id = $1
		`
		args = []any{scope.ID}
	case models.RejudgeScopeProblemVersion:
		query = `
			SELECT id, user_id, problem_version_id, contest_id, language, source_hash, source,
			       status, verdict, created_at
			FROM submissions
			WHERE problem_version_id = $1
			ORDER BY created_at ASC
		`
		args = []any{scope.ID}
	case models.RejudgeScopeContest:
		query = `
			SELECT id, user_id, problem_version_id, contest_id, language, source_hash, source,
			       status, verdict, created_at
			FROM submissions
			WHERE contest_id = $1
			ORDER BY created_at ASC
		`
		args = []any{scope.ID}
	default:
		return nil, fmt.Errorf("unknown rejudge scope type: %s", scope.Type)
	}

	rows, err := db.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []models.Submission
	for rows.Next() {
		var s models.Submission
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.ProblemVersionID, &s.ContestID, &s.Language, &s.SourceHash, &s.Source,
			&s.Status, &s.Verdict, &s.CreatedAt,
		); err == nil {
			subs = append(subs, s)
		}
	}
	return subs, nil
}

// RequeueSubmissionForRejudge resets a submission to QUEUED, deletes prior test results,
// and atomically inserts an outbox job in the standard/rejudge priority lane.
func (db *DB) RequeueSubmissionForRejudge(ctx context.Context, submissionID uuid.UUID, jobPayload any) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Reset Submission state (preserving original created_at timestamp for contest scoring fairness)
	updateSub := `
		UPDATE submissions
		SET status = 'QUEUED', verdict = 'PENDING',
		    time_ms = NULL, memory_kb = NULL, instructions = NULL,
		    failed_test = NULL, complexity_report = NULL, judged_at = NULL
		WHERE id = $1
	`
	if _, err := tx.Exec(ctx, updateSub, submissionID); err != nil {
		return fmt.Errorf("failed to reset submission state: %w", err)
	}

	// 2. Clear old individual test results
	if _, err := tx.Exec(ctx, "DELETE FROM submission_results WHERE submission_id = $1", submissionID); err != nil {
		return fmt.Errorf("failed to delete prior test results: %w", err)
	}

	// 3. Insert Outbox Entry for standard/rejudge lane
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
	if _, err := tx.Exec(ctx, queryOutbox, outboxID, "jobs.submissions.standard", payloadJSON, time.Now().UTC()); err != nil {
		return fmt.Errorf("failed to insert outbox row: %w", err)
	}

	return tx.Commit(ctx)
}

// GetRejudgeBatchStatus retrieves the current progress of a rejudge batch
func (db *DB) GetRejudgeBatchStatus(ctx context.Context, batchID uuid.UUID) (*models.RejudgeBatchStatus, error) {
	queryBatch := `
		SELECT id, scope, created_at
		FROM rejudge_batches
		WHERE id = $1
	`
	var b models.RejudgeBatch
	var scopeBytes []byte
	err := db.pool.QueryRow(ctx, queryBatch, batchID).Scan(&b.ID, &scopeBytes, &b.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("rejudge batch not found: %w", err)
	}
	_ = json.Unmarshal(scopeBytes, &b.Scope)

	// Query status count for scoped submissions
	status := &models.RejudgeBatchStatus{
		BatchID:   b.ID.String(),
		ScopeType: string(b.Scope.Type),
		ScopeID:   b.Scope.ID.String(),
		CreatedAt: b.CreatedAt,
	}

	subs, err := db.GetSubmissionsForRejudge(ctx, b.Scope)
	if err == nil {
		status.TotalJobs = len(subs)
		for _, s := range subs {
			if s.Status == models.StatusDone {
				status.Completed++
			} else {
				status.Pending++
			}
		}
	}

	return status, nil
}

// FetchStaleSubmissions retrieves submissions stuck in processing states beyond lease timeout
func (db *DB) FetchStaleSubmissions(ctx context.Context, olderThan time.Duration, limit int) ([]models.Submission, error) {
	threshold := time.Now().UTC().Add(-olderThan)
	query := `
		SELECT id, user_id, problem_version_id, contest_id, language, source_hash, source,
		       status, verdict, created_at
		FROM submissions
		WHERE status IN ('QUEUED', 'RUNNING', 'COMPILING', 'JUDGING')
		  AND created_at < $1
		ORDER BY created_at ASC
		LIMIT $2
	`
	rows, err := db.pool.Query(ctx, query, threshold, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []models.Submission
	for rows.Next() {
		var s models.Submission
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.ProblemVersionID, &s.ContestID, &s.Language, &s.SourceHash, &s.Source,
			&s.Status, &s.Verdict, &s.CreatedAt,
		); err == nil {
			subs = append(subs, s)
		}
	}
	return subs, nil
}

// MarkSubmissionSystemError marks a dead-lettered / unrecoverable submission as terminal SE
func (db *DB) MarkSubmissionSystemError(ctx context.Context, subID uuid.UUID, reason string) error {
	now := time.Now().UTC()
	query := `
		UPDATE submissions
		SET status = 'DONE', verdict = 'SE', judged_at = $1
		WHERE id = $2 AND status != 'DONE'
	`
	_, err := db.pool.Exec(ctx, query, now, subID)
	return err
}

// GetSubmissionVerdictCounts returns the aggregate count of submissions per verdict
func (db *DB) GetSubmissionVerdictCounts(ctx context.Context) (map[string]int64, error) {
	query := `
		SELECT COALESCE(verdict::text, 'PENDING'), COUNT(*)
		FROM submissions
		GROUP BY verdict
	`
	rows, err := db.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int64)
	for rows.Next() {
		var verdict string
		var count int64
		if err := rows.Scan(&verdict, &count); err == nil {
			counts[verdict] = count
		}
	}
	return counts, nil
}

// GetQueueDepths returns the count of unpublished outbox entries grouped by subject lane
func (db *DB) GetQueueDepths(ctx context.Context) (map[string]int64, error) {
	query := `
		SELECT subject, COUNT(*)
		FROM outbox
		WHERE published_at IS NULL
		GROUP BY subject
	`
	rows, err := db.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	depths := make(map[string]int64)
	for rows.Next() {
		var subject string
		var count int64
		if err := rows.Scan(&subject, &count); err == nil {
			depths[subject] = count
		}
	}
	return depths, nil
}


