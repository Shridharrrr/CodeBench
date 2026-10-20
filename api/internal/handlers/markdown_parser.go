package handlers

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/codebench/codebench/api/internal/models"
	"gopkg.in/yaml.v3"
)

type ParsedProblemMD struct {
	Slug        string            `yaml:"slug" json:"slug"`
	Title       string            `yaml:"title" json:"title"`
	Difficulty  string            `yaml:"difficulty" json:"difficulty"`
	Tags        []string          `yaml:"tags" json:"tags"`
	TimeLimitMS int               `yaml:"time_limit_ms" json:"time_limit_ms"`
	MemoryMB    int               `yaml:"memory_mb" json:"memory_mb"`
	CheckerType string            `yaml:"checker_type" json:"checker_type"`
	ContestLabel string           `yaml:"contest_label" json:"contest_label"`
	Points      int               `yaml:"points" json:"points"`
	StatementMD string            `yaml:"-" json:"statement_md"`
	SampleTests []models.TestCase `yaml:"-" json:"sample_tests"`
	HiddenTests []models.TestCase `yaml:"-" json:"hidden_tests"`
}

var (
	frontmatterRegex = regexp.MustCompile(`(?s)^---\r?\n(.*?)\r?\n---\r?\n`)
	codeBlockRegex   = regexp.MustCompile("(?s)```(?:[a-zA-Z0-9_-]+)?\\s*\\r?\\n(.*?)\\r?\\n```")
	inputBlockRegex  = regexp.MustCompile("(?is)```input\\s*\\r?\\n(.*?)\\r?\\n```")
	outputBlockRegex = regexp.MustCompile("(?is)```output\\s*\\r?\\n(.*?)\\r?\\n```")
)

func ParseProblemMarkdown(content string) (*ParsedProblemMD, error) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return nil, fmt.Errorf("markdown content is empty")
	}

	result := &ParsedProblemMD{
		TimeLimitMS:  1000,
		MemoryMB:     256,
		Difficulty:   "Medium",
		CheckerType:  "token",
		ContestLabel: "A",
		Points:       100,
	}

	body := trimmed

	// 1. Extract and Unmarshal YAML Frontmatter if present
	if fmMatch := frontmatterRegex.FindStringSubmatch(content); len(fmMatch) > 1 {
		fmContent := fmMatch[1]
		if err := yaml.Unmarshal([]byte(fmContent), result); err != nil {
			return nil, fmt.Errorf("invalid YAML frontmatter: %w", err)
		}
		body = strings.TrimSpace(content[len(fmMatch[0]):])
	}

	// 2. Parse Test Case Sections and Statement
	// Split by Markdown Headings H2-H3 so subheadings (like #### Input) remain inside
	headingSplitter := regexp.MustCompile(`(?m)(^#{2,3}\s+)`)
	indices := headingSplitter.FindAllStringIndex(body, -1)

	var sections []string
	if len(indices) == 0 {
		sections = []string{body}
	} else {
		lastIdx := 0
		for _, loc := range indices {
			if loc[0] > lastIdx {
				sections = append(sections, body[lastIdx:loc[0]])
			}
			lastIdx = loc[0]
		}
		if lastIdx < len(body) {
			sections = append(sections, body[lastIdx:])
		}
	}

	var statementBuilder strings.Builder
	sampleOrdinal := 1
	hiddenOrdinal := 1

	for _, sec := range sections {
		secTrim := strings.TrimSpace(sec)
		if secTrim == "" {
			continue
		}

		secLower := strings.ToLower(secTrim)
		isSample := strings.HasPrefix(secLower, "## sample") ||
			strings.HasPrefix(secLower, "### sample") ||
			strings.HasPrefix(secLower, "## example") ||
			strings.HasPrefix(secLower, "### example")

		isHidden := strings.HasPrefix(secLower, "## hidden") ||
			strings.HasPrefix(secLower, "### hidden") ||
			strings.HasPrefix(secLower, "## secret") ||
			strings.HasPrefix(secLower, "### secret")

		if isSample || isHidden {
			inMatches := inputBlockRegex.FindAllStringSubmatch(secTrim, -1)
			outMatches := outputBlockRegex.FindAllStringSubmatch(secTrim, -1)

			var pairs [][2]string
			if len(inMatches) > 0 && len(inMatches) == len(outMatches) {
				for i := 0; i < len(inMatches); i++ {
					pairs = append(pairs, [2]string{
						strings.TrimSpace(inMatches[i][1]),
						strings.TrimSpace(outMatches[i][1]),
					})
				}
			} else {
				// Fallback to standard sequential code blocks
				allBlocks := codeBlockRegex.FindAllStringSubmatch(secTrim, -1)
				for i := 0; i+1 < len(allBlocks); i += 2 {
					pairs = append(pairs, [2]string{
						strings.TrimSpace(allBlocks[i][1]),
						strings.TrimSpace(allBlocks[i+1][1]),
					})
				}
			}

			for _, p := range pairs {
				if isSample {
					result.SampleTests = append(result.SampleTests, models.TestCase{
						GroupName:  "sample",
						Ordinal:    sampleOrdinal,
						InputData:  p[0],
						OutputData: p[1],
						IsSample:   true,
					})
					sampleOrdinal++
				} else {
					result.HiddenTests = append(result.HiddenTests, models.TestCase{
						GroupName:  "hidden",
						Ordinal:    hiddenOrdinal,
						InputData:  p[0],
						OutputData: p[1],
						IsSample:   false,
					})
					hiddenOrdinal++
				}
			}

			if isSample {
				// Keep sample cases in statement prose for contestants to view
				statementBuilder.WriteString("\n\n" + secTrim)
			}
			// Do NOT append hidden tests to public statement!
		} else {
			statementBuilder.WriteString("\n\n" + secTrim)
		}
	}

	result.StatementMD = strings.TrimSpace(statementBuilder.String())

	// If title is missing from frontmatter, derive from H1 heading
	if result.Title == "" {
		h1Regex := regexp.MustCompile(`(?m)^#\s+(.+)$`)
		if h1Match := h1Regex.FindStringSubmatch(result.StatementMD); len(h1Match) > 1 {
			result.Title = strings.TrimSpace(h1Match[1])
		}
	}

	// Slug derivation
	if result.Slug == "" && result.Title != "" {
		slugClean := strings.ToLower(result.Title)
		slugClean = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(slugClean, "-")
		slugClean = strings.Trim(slugClean, "-")
		result.Slug = slugClean
	}

	// Validate mandatory fields
	if result.Title == "" {
		return nil, fmt.Errorf("problem title is required (in frontmatter or # Title heading)")
	}
	if result.Slug == "" {
		return nil, fmt.Errorf("problem slug is required")
	}
	if result.StatementMD == "" {
		return nil, fmt.Errorf("problem statement is empty")
	}

	return result, nil
}
