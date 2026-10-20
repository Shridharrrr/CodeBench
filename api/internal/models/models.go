package models

import (
	"time"

	"github.com/google/uuid"
)

type SubmissionStatus string

const (
	StatusQueued    SubmissionStatus = "QUEUED"
	StatusCompiling SubmissionStatus = "COMPILING"
	StatusRunning   SubmissionStatus = "RUNNING"
	StatusJudging   SubmissionStatus = "JUDGING"
	StatusDone      SubmissionStatus = "DONE"
)

type Verdict string

const (
	VerdictPending        Verdict = "PENDING"
	VerdictAC             Verdict = "AC"             // Accepted
	VerdictWA             Verdict = "WA"             // Wrong Answer
	VerdictTLE            Verdict = "TLE"            // Time Limit Exceeded
	VerdictMLE            Verdict = "MLE"            // Memory Limit Exceeded
	VerdictOLE            Verdict = "OLE"            // Output Limit Exceeded
	VerdictRE             Verdict = "RE"             // Runtime Error
	VerdictCE             Verdict = "CE"             // Compilation Error
	VerdictSE             Verdict = "SE"             // System Error
	VerdictComplexityFail Verdict = "COMPLEXITY_FAIL" // Complexity policy breached
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type Problem struct {
	ID        uuid.UUID `json:"id"`
	Slug      string    `json:"slug"`
	OwnerID   *uuid.UUID `json:"owner_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ProblemVersion struct {
	ID               uuid.UUID         `json:"id"`
	ProblemID        uuid.UUID         `json:"problem_id"`
	Version          int               `json:"version"`
	Title            string            `json:"title"`
	StatementMD      string            `json:"statement_md"`
	Difficulty       string            `json:"difficulty"`
	Tags             []string          `json:"tags"`
	TimeLimitMS      int               `json:"time_limit_ms"`
	MemoryMB         int               `json:"memory_mb"`
	CheckerType      string            `json:"checker_type"`
	ComplexityPolicy map[string]any    `json:"complexity_policy"`
	PackageHash      string            `json:"package_hash"`
	PublishedAt      time.Time         `json:"published_at"`
}

type TestCase struct {
	ID               uuid.UUID `json:"id"`
	ProblemVersionID uuid.UUID `json:"problem_version_id"`
	GroupName        string    `json:"group_name"`
	Ordinal          int       `json:"ordinal"`
	InputData        string    `json:"input_data"`
	OutputData       string    `json:"output_data"`
	IsSample         bool      `json:"is_sample"`
}

type ContestState string

const (
	ContestUpcoming ContestState = "UPCOMING"
	ContestRunning  ContestState = "RUNNING"
	ContestFrozen   ContestState = "FROZEN"
	ContestEnded    ContestState = "ENDED"
)

type Contest struct {
	ID            uuid.UUID  `json:"id"`
	Title         string     `json:"title"`
	Mode          string     `json:"mode"`       // "fixed" or "practice"
	StartsAt      time.Time  `json:"starts_at"`
	EndsAt        time.Time  `json:"ends_at"`
	FreezeAt      *time.Time `json:"freeze_at,omitempty"`
	Scoring       string     `json:"scoring"`    // "icpc", "points", or "ctfd"
	OwnerID       *uuid.UUID `json:"owner_id,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	IsPaused      bool       `json:"is_paused"`
	IsTeamContest bool       `json:"is_team_contest"`
	MaxTeamSize   int        `json:"max_team_size"`
}

type Team struct {
	ID        uuid.UUID    `json:"id"`
	Name      string       `json:"name"`
	JoinCode  string       `json:"join_code"`
	CaptainID uuid.UUID    `json:"captain_id"`
	CreatedAt time.Time    `json:"created_at"`
	Members   []TeamMember `json:"members,omitempty"`
}

type TeamMember struct {
	TeamID    uuid.UUID `json:"team_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name,omitempty"`
	UserEmail string    `json:"user_email,omitempty"`
	JoinedAt  time.Time `json:"joined_at"`
}

type ScoreAdjustment struct {
	ID         uuid.UUID  `json:"id"`
	ContestID  uuid.UUID  `json:"contest_id"`
	TeamID     *uuid.UUID `json:"team_id,omitempty"`
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	UserName   string     `json:"user_name,omitempty"`
	Points     int        `json:"points"`
	Reason     string     `json:"reason"`
	AdjustedBy uuid.UUID  `json:"adjusted_by"`
	AdminName  string     `json:"admin_name,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type ContestProblem struct {
	ContestID        uuid.UUID `json:"contest_id"`
	ProblemVersionID uuid.UUID `json:"problem_version_id"`
	Label            string    `json:"label"` // 'A', 'B', 'C', ...
	Points           int       `json:"points"`
	MinPoints        int       `json:"min_points,omitempty"`
	DecayRate        int       `json:"decay_rate,omitempty"`
	Title            string    `json:"title,omitempty"`
	Slug             string    `json:"slug,omitempty"`
	Difficulty       string    `json:"difficulty,omitempty"`
}

type Participant struct {
	ContestID uuid.UUID `json:"contest_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name,omitempty"`
	UserEmail string    `json:"user_email,omitempty"`
	JoinedAt  time.Time `json:"joined_at"`
}

type ProblemCell struct {
	Label             string `json:"label"`
	Solved            bool   `json:"solved"`
	SolvedTimeMinutes int64  `json:"solved_time_minutes,omitempty"`
	AttemptCount      int    `json:"attempt_count"`
	Points            int    `json:"points"`
	IsFrozen          bool   `json:"is_frozen"`
}

type LeaderboardRow struct {
	Rank        int                    `json:"rank"`
	UserID      uuid.UUID              `json:"user_id"`
	UserName    string                 `json:"user_name"`
	TeamID      *uuid.UUID             `json:"team_id,omitempty"`
	TeamName    string                 `json:"team_name,omitempty"`
	Score       int                    `json:"score"`   // Solved count (ICPC) or Points
	Penalty     int64                  `json:"penalty"` // Minutes
	Adjustments int                    `json:"adjustments,omitempty"`
	LastACTime  *time.Time             `json:"last_ac_time,omitempty"`
	Problems    map[string]ProblemCell `json:"problems"`
}

type Leaderboard struct {
	ContestID uuid.UUID        `json:"contest_id"`
	IsFrozen  bool             `json:"is_frozen"`
	UpdatedAt time.Time        `json:"updated_at"`
	Rows      []LeaderboardRow `json:"rows"`
}


type Submission struct {
	ID               uuid.UUID         `json:"id"`
	UserID           *uuid.UUID        `json:"user_id,omitempty"`
	ProblemVersionID uuid.UUID         `json:"problem_version_id"`
	ContestID        *uuid.UUID        `json:"contest_id,omitempty"`
	Language         string            `json:"language"`
	SourceHash       string            `json:"source_hash"`
	Source           string            `json:"source"`
	Status           SubmissionStatus  `json:"status"`
	Verdict          Verdict           `json:"verdict"`
	TimeMS           int64             `json:"time_ms"`
	MemoryKB         int64             `json:"memory_kb"`
	Instructions     int64             `json:"instructions"`
	FailedTest       *int              `json:"failed_test,omitempty"`
	FailedGroup      *string           `json:"failed_group,omitempty"`
	CompileOutput    *string           `json:"compile_output,omitempty"`
	ComplexityReport map[string]any    `json:"complexity_report,omitempty"`
	JudgeHost        *string           `json:"judge_host,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
	JudgedAt         *time.Time        `json:"judged_at,omitempty"`
	Results          []SubmissionResult `json:"results,omitempty"`
}

type SubmissionResult struct {
	ID           uuid.UUID `json:"id"`
	SubmissionID uuid.UUID `json:"submission_id"`
	TestID       *uuid.UUID `json:"test_id,omitempty"`
	Ordinal      int       `json:"ordinal"`
	Verdict      Verdict   `json:"verdict"`
	TimeMS       int64     `json:"time_ms"`
	MemoryKB     int64     `json:"memory_kb"`
	Instructions int64     `json:"instructions"`
	Diagnostic   string    `json:"diagnostic,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type OutboxEntry struct {
	ID          uuid.UUID `json:"id"`
	Subject     string    `json:"subject"`
	Payload     any       `json:"payload"`
	CreatedAt   time.Time `json:"created_at"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}

// Queue Job payload sent to judge daemons
type JudgeJobPayload struct {
	SubmissionID     string     `json:"submission_id"`
	AttemptID        string     `json:"attempt_id"`
	Language         string     `json:"language"`
	SourceCode       string     `json:"source_code"`
	TimeLimitMS      int64      `json:"time_limit_ms"`
	MemoryLimitKB    int64      `json:"memory_limit_kb"`
	CheckerType      string     `json:"checker_type"`
	ComplexityPolicy string     `json:"complexity_policy"`
	TestCases        []TestCase `json:"test_cases"`
}

// Verdict payload received from judge daemons
type JudgeVerdictPayload struct {
	SubmissionID     string                  `json:"submission_id"`
	AttemptID        string                  `json:"attempt_id"`
	Status           SubmissionStatus        `json:"status"`
	Verdict          Verdict                 `json:"verdict"`
	TotalTimeMS      int64                   `json:"total_time_ms"`
	PeakMemoryKB     int64                   `json:"peak_memory_kb"`
	TotalInstructions int64                  `json:"total_instructions"`
	FailedTest       *int                    `json:"failed_test,omitempty"`
	FailedGroup      *string                 `json:"failed_group,omitempty"`
	CompileOutput    string                  `json:"compile_output,omitempty"`
	ComplexityReport map[string]any          `json:"complexity_report,omitempty"`
	JudgeHost        string                  `json:"judge_host"`
	TestResults      []JudgeTestResultDetail `json:"test_results"`
}

type JudgeTestResultDetail struct {
	Ordinal      int     `json:"ordinal"`
	GroupName    string  `json:"group_name"`
	Verdict      Verdict `json:"verdict"`
	TimeMS       int64   `json:"time_ms"`
	MemoryKB     int64   `json:"memory_kb"`
	Instructions int64   `json:"instructions"`
	Diagnostic   string  `json:"diagnostic,omitempty"`
}

// Submission request from client
type SubmitRequest struct {
	Language string `json:"language"`
	Source   string `json:"source"`
}

type SubmitResponse struct {
	SubmissionID string           `json:"submission_id"`
	Status       SubmissionStatus `json:"status"`
}

// Session represents an active authenticated user session
type Session struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	TokenHash string    `json:"-"`
	CSRFToken string    `json:"csrf_token"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	UserAgent string    `json:"user_agent,omitempty"`
	IPAddress string    `json:"ip_address,omitempty"`
}

// Auth requests and responses
type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserProfile struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type AuthResponse struct {
	User      UserProfile `json:"user"`
	CSRFToken string      `json:"csrf_token"`
}

// Sample / Custom Run models
type RunRequest struct {
	Language    string `json:"language"`
	Source      string `json:"source"`
	CustomInput string `json:"custom_input,omitempty"`
}

type RunSampleResult struct {
	Ordinal    int    `json:"ordinal"`
	GroupName  string `json:"group_name"`
	Verdict    string `json:"verdict"`
	TimeMS     int64  `json:"time_ms"`
	MemoryKB   int64  `json:"memory_kb"`
	Input      string `json:"input"`
	Expected   string `json:"expected"`
	Actual     string `json:"actual"`
	Diagnostic string `json:"diagnostic,omitempty"`
}

type RunResponse struct {
	Status        string            `json:"status"`
	Verdict       string            `json:"verdict"`
	CompileOutput string            `json:"compile_output,omitempty"`
	TimeMS        int64             `json:"time_ms"`
	MemoryKB      int64             `json:"memory_kb"`
	SampleResults []RunSampleResult `json:"sample_results,omitempty"`
}

// Practice Mode (Mode B) models
type PracticeGenerateRequest struct {
	Count           int      `json:"count"`            // default 3, max 10
	Difficulty      string   `json:"difficulty"`       // "EASY", "MEDIUM", "HARD", "ANY"
	Tags            []string `json:"tags"`             // e.g. ["array"]
	ExcludeSolved   bool     `json:"exclude_solved"`   // defaults to true
	DurationMinutes int      `json:"duration_minutes"` // 0 or null for untimed
	Seed            *int64   `json:"seed,omitempty"`   // deterministic random seed
}

type PracticeGenerateResponse struct {
	ContestID       uuid.UUID               `json:"contest_id"`
	Title           string                  `json:"title"`
	Mode            string                  `json:"mode"`
	StartsAt        time.Time               `json:"starts_at"`
	EndsAt          time.Time               `json:"ends_at"`
	DurationMinutes int                     `json:"duration_minutes"`
	ProblemCount    int                     `json:"problem_count"`
	Problems        []ContestProblemSummary `json:"problems"`
}

type ContestProblemSummary struct {
	Label      string   `json:"label"`
	Points     int      `json:"points"`
	Title      string   `json:"title"`
	Slug       string   `json:"slug"`
	Difficulty string   `json:"difficulty"`
	Tags       []string `json:"tags"`
}

// Complexity Policy and Report models
type ComplexityPolicy struct {
	Policy          string `json:"policy"`                     // e.g. "query_budget", "scaling", "query_or_scaling"
	TimeComplexity  string `json:"time_complexity,omitempty"`  // e.g. "O(log N)", "O(1)", "O(N log N)"
	SpaceComplexity string `json:"space_complexity,omitempty"` // e.g. "O(1)", "O(C)"
	MaxQueries      int    `json:"max_queries,omitempty"`      // e.g. 25
	BudgetFormula   string `json:"budget_formula,omitempty"`   // e.g. "ceil(log2(N)) + 5"
}

type ComplexityReport struct {
	Policy           string `json:"policy"`
	TargetComplexity string `json:"target_complexity"`
	SpaceComplexity  string `json:"space_complexity,omitempty"`
	MeasuredScaling  string `json:"measured_scaling,omitempty"`
	QueryCount       int    `json:"query_count,omitempty"`
	QueryLimit       int    `json:"query_limit,omitempty"`
	Passed           bool   `json:"passed"`
	Diagnostic       string `json:"diagnostic,omitempty"`
}

// Priority Lane Constants
const (
	LanePriority = "priority" // Interactive run & active contests
	LaneStandard = "standard" // Practice mode submissions & background rejudges
	LaneRejudge  = "rejudge"
)

// Rejudge Models
type RejudgeScopeType string

const (
	RejudgeScopeSubmission     RejudgeScopeType = "submission"
	RejudgeScopeProblemVersion RejudgeScopeType = "problem_version"
	RejudgeScopeContest        RejudgeScopeType = "contest"
)

type RejudgeScope struct {
	Type RejudgeScopeType `json:"type"`
	ID   uuid.UUID        `json:"id"`
}

type RejudgeBatch struct {
	ID          uuid.UUID    `json:"id"`
	Scope       RejudgeScope `json:"scope"`
	RequestedBy *uuid.UUID   `json:"requested_by"`
	CreatedAt   time.Time    `json:"created_at"`
}

type RejudgeBatchRequest struct {
	ScopeType RejudgeScopeType `json:"scope_type"`
	ScopeID   string           `json:"scope_id"`
}

type RejudgeBatchResponse struct {
	BatchID     string           `json:"batch_id"`
	ScopeType   RejudgeScopeType `json:"scope_type"`
	ScopeID     string           `json:"scope_id"`
	QueuedCount int              `json:"queued_count"`
	Status      string           `json:"status"`
}

type RejudgeBatchStatus struct {
	BatchID   string    `json:"batch_id"`
	ScopeType string    `json:"scope_type"`
	ScopeID   string    `json:"scope_id"`
	TotalJobs int       `json:"total_jobs"`
	Completed int       `json:"completed"`
	Pending   int       `json:"pending"`
	CreatedAt time.Time `json:"created_at"`
}

