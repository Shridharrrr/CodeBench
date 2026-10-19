package problems

import (
	"bytes"
	"fmt"
	"regexp"

	"gopkg.in/yaml.v3"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type ProblemLimits struct {
	TimeLimitMS   int `yaml:"time_limit_ms"`
	MemoryLimitMB int `yaml:"memory_limit_mb"`
}

type CheckerConfig struct {
	Type    string  `yaml:"type"`              // token, float, custom
	Epsilon float64 `yaml:"epsilon,omitempty"` // For float checkers
}

type ComplexityConfig struct {
	Policy          string `yaml:"policy"`                     // e.g. query_or_scaling, query_budget
	TimeComplexity  string `yaml:"time_complexity,omitempty"`  // e.g. "O(N)"
	SpaceComplexity string `yaml:"space_complexity,omitempty"` // e.g. "O(1)"
	MaxQueries      int    `yaml:"max_queries,omitempty"`
}

type TestGroupConfig struct {
	Name   string `yaml:"name"`
	Weight int    `yaml:"weight"`
}

type ProblemYAML struct {
	Slug        string            `yaml:"slug"`
	Version     int               `yaml:"version"`
	Title       string            `yaml:"title"`
	Difficulty  string            `yaml:"difficulty"` // Easy, Medium, Hard
	Tags        []string          `yaml:"tags"`
	Languages   []string          `yaml:"languages"`
	Limits      ProblemLimits     `yaml:"limits"`
	Checker     CheckerConfig     `yaml:"checker"`
	Complexity  ComplexityConfig  `yaml:"complexity"`
	TestGroups  []TestGroupConfig `yaml:"test_groups"`
}

type ProblemTestCase struct {
	GroupName  string
	Name       string
	Ordinal    int
	InputData  string
	OutputData string
	IsSample   bool
}

type WrongSolution struct {
	Filename        string
	ExpectedVerdict string // WA, TLE, MLE, RE, CE
	SourceCode      string
}

type ProblemPackage struct {
	Directory      string
	Manifest       ProblemYAML
	StatementMD    string
	RefSolution    string
	WrongSolutions []WrongSolution
	TestCases      []ProblemTestCase
	CanonicalHash  string
}

// ParseProblemYAML strictly unmarshals and validates problem.yaml bytes
func ParseProblemYAML(data []byte) (*ProblemYAML, error) {
	dec := yaml.NewDecoder(bytes.NewReader(data))
	dec.KnownFields(true) // Reject unknown fields

	var manifest ProblemYAML
	if err := dec.Decode(&manifest); err != nil {
		return nil, fmt.Errorf("invalid YAML syntax or unknown fields: %w", err)
	}

	if err := ValidateManifest(&manifest); err != nil {
		return nil, err
	}

	return &manifest, nil
}

// ValidateManifest enforces domain constraints on problem manifest
func ValidateManifest(m *ProblemYAML) error {
	if !slugRegex.MatchString(m.Slug) {
		return fmt.Errorf("invalid slug %q: must be lowercase alphanumeric with hyphens", m.Slug)
	}
	if m.Version < 1 {
		return fmt.Errorf("invalid version %d: must be >= 1", m.Version)
	}
	if len(m.Title) == 0 || len(m.Title) > 255 {
		return fmt.Errorf("invalid title: must be between 1 and 255 characters")
	}

	switch m.Difficulty {
	case "Easy", "Medium", "Hard":
		// valid
	default:
		return fmt.Errorf("invalid difficulty %q: must be Easy, Medium, or Hard", m.Difficulty)
	}

	if len(m.Languages) == 0 {
		return fmt.Errorf("languages cannot be empty")
	}
	for _, lang := range m.Languages {
		switch lang {
		case "cpp23-gcc", "cpp23-clang", "c23-gcc", "c23-clang":
			// supported
		default:
			return fmt.Errorf("unsupported language %q", lang)
		}
	}

	if m.Limits.TimeLimitMS < 50 || m.Limits.TimeLimitMS > 30000 {
		return fmt.Errorf("invalid time_limit_ms %d: must be between 50 and 30000", m.Limits.TimeLimitMS)
	}
	if m.Limits.MemoryLimitMB < 16 || m.Limits.MemoryLimitMB > 2048 {
		return fmt.Errorf("invalid memory_limit_mb %d: must be between 16 and 2048", m.Limits.MemoryLimitMB)
	}

	switch m.Checker.Type {
	case "token", "float", "custom":
		// valid
	default:
		return fmt.Errorf("unsupported checker type %q: must be token, float, or custom", m.Checker.Type)
	}

	if len(m.TestGroups) == 0 {
		return fmt.Errorf("test_groups cannot be empty")
	}

	// Verify sample group exists
	hasSample := false
	for _, tg := range m.TestGroups {
		if tg.Name == "sample" {
			hasSample = true
			break
		}
	}
	if !hasSample {
		return fmt.Errorf("test_groups must include a 'sample' group")
	}

	return nil
}
