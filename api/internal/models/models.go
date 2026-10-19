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
