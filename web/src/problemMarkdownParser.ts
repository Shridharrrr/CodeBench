export interface TestCaseParsed {
  ordinal: number;
  input_data: string;
  output_data: string;
}

export interface ParsedProblem {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  time_limit_ms: number;
  memory_mb: number;
  contest_label: string;
  points: number;
  checker_type: string;
  statement_md: string;
  sample_tests: TestCaseParsed[];
  hidden_tests: TestCaseParsed[];
  errors: string[];
  warnings: string[];
}

// Parses standard YAML frontmatter lines
function parseFrontmatter(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = '';
  let currentList: string[] | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // Check for list item
    if (line.startsWith('- ') && currentKey) {
      if (!currentList) {
        currentList = [];
        result[currentKey] = currentList;
      }
      currentList.push(line.substring(2).trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      currentKey = line.substring(0, colonIdx).trim();
      currentList = null;
      const rawVal = line.substring(colonIdx + 1).trim();

      if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        // Inline array: [array, math]
        result[currentKey] = rawVal
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else if (rawVal !== '') {
        const cleanVal = rawVal.replace(/^['"]|['"]$/g, '');
        if (/^\d+$/.test(cleanVal)) {
          result[currentKey] = parseInt(cleanVal, 10);
        } else if (/^(true|false)$/i.test(cleanVal)) {
          result[currentKey] = cleanVal.toLowerCase() === 'true';
        } else {
          result[currentKey] = cleanVal;
        }
      }
    }
  }

  return result;
}

// Extracts code block content from markdown (```...```)
export function extractFencedBlock(text: string, type: string): string | null {
  const regex = new RegExp(`\`\`\`(?:${type})?\\s*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\``, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function parseProblemMarkdown(content: string): ParsedProblem {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || !content.trim()) {
    return {
      slug: '',
      title: '',
      difficulty: 'Medium',
      tags: [],
      time_limit_ms: 1000,
      memory_mb: 256,
      contest_label: 'A',
      points: 100,
      checker_type: 'token',
      statement_md: '',
      sample_tests: [],
      hidden_tests: [],
      errors: ['Markdown content is empty.'],
      warnings: [],
    };
  }

  // 1. Extract Frontmatter
  let frontmatterData: Record<string, any> = {};
  let bodyMarkdown = content.trim();

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fmMatch) {
    frontmatterData = parseFrontmatter(fmMatch[1]);
    bodyMarkdown = content.substring(fmMatch[0].length).trim();
  } else {
    warnings.push('No YAML frontmatter found (--- ... ---). Defaults applied for limits and metadata.');
  }

  // 2. Parse Test Cases from sections
  const sample_tests: TestCaseParsed[] = [];
  const hidden_tests: TestCaseParsed[] = [];

  // Split into sections by Markdown headings H2-H3 so subheadings (like #### Input) remain inside
  const sections = bodyMarkdown.split(/(?=^#{2,3}\s+)/m);
  const statementSections: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    const isSampleSection =
      lower.startsWith('## sample') ||
      lower.startsWith('### sample') ||
      lower.startsWith('## example') ||
      lower.startsWith('### example');

    const isHiddenSection =
      lower.startsWith('## hidden') ||
      lower.startsWith('### hidden') ||
      lower.startsWith('## secret') ||
      lower.startsWith('### secret');

    if (isSampleSection || isHiddenSection) {
      const pairs: [string, string][] = [];

      // Check for ```input and ```output blocks
      const inputMatches = [...trimmed.matchAll(/```input\s*\r?\n([\s\S]*?)\r?\n```/gi)];
      const outputMatches = [...trimmed.matchAll(/```output\s*\r?\n([\s\S]*?)\r?\n```/gi)];

      if (inputMatches.length > 0 && inputMatches.length === outputMatches.length) {
        for (let i = 0; i < inputMatches.length; i++) {
          pairs.push([inputMatches[i][1].trim(), outputMatches[i][1].trim()]);
        }
      } else {
        // Fallback: Check for generic ``` blocks (pair them sequentially)
        const allBlocks = [...trimmed.matchAll(/```(?:\w+)?\s*\r?\n([\s\S]*?)\r?\n```/g)];
        for (let i = 0; i + 1 < allBlocks.length; i += 2) {
          pairs.push([allBlocks[i][1].trim(), allBlocks[i + 1][1].trim()]);
        }
      }

      const targetList = isSampleSection ? sample_tests : hidden_tests;
      for (const [inData, outData] of pairs) {
        targetList.push({
          ordinal: targetList.length + 1,
          input_data: inData,
          output_data: outData,
        });
      }

      // Also keep sample section in statement for problem description
      if (isSampleSection) {
        statementSections.push(section);
      }
    } else {
      statementSections.push(section);
    }
  }

  // Derive statement Markdown
  let statement_md = statementSections.join('\n\n').trim();

  // If no heading was in frontmatter title, extract H1 title from body if present
  let title = String(frontmatterData.title || '').trim();
  if (!title) {
    const h1Match = statement_md.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  // Slug derivation
  let slug = String(frontmatterData.slug || '').trim();
  if (!slug && title) {
    slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Defaults
  const difficultyRaw = String(frontmatterData.difficulty || 'Medium').toLowerCase();
  const difficulty: 'Easy' | 'Medium' | 'Hard' =
    difficultyRaw === 'easy' ? 'Easy' : difficultyRaw === 'hard' ? 'Hard' : 'Medium';

  let tags: string[] = [];
  if (Array.isArray(frontmatterData.tags)) {
    tags = frontmatterData.tags.map(String);
  } else if (typeof frontmatterData.tags === 'string') {
    tags = frontmatterData.tags.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const time_limit_ms = Number(frontmatterData.time_limit_ms) || 1000;
  const memory_mb = Number(frontmatterData.memory_mb) || 256;
  const contest_label = String(frontmatterData.contest_label || 'A').toUpperCase().trim();
  const points = Number(frontmatterData.points) || 100;
  const checker_type = String(frontmatterData.checker_type || 'token').trim();

  // Validation
  if (!title) errors.push('Problem title is missing. Specify `title:` in frontmatter or `# Title` heading.');
  if (!slug) errors.push('Problem slug is missing. Specify `slug:` in frontmatter.');
  if (!statement_md) errors.push('Problem statement description is empty.');
  if (sample_tests.length === 0) {
    warnings.push('No sample test cases found. Ensure you include `### Sample Test 1` with ```input and ```output blocks.');
  }
  if (hidden_tests.length === 0) {
    warnings.push('No hidden test cases found in markdown. You can add them in the editor or include `### Hidden Test 1`.');
  }

  return {
    slug,
    title,
    difficulty,
    tags,
    time_limit_ms,
    memory_mb,
    contest_label,
    points,
    checker_type,
    statement_md,
    sample_tests,
    hidden_tests,
    errors,
    warnings,
  };
}

export function generateProblemMarkdownTemplate(): string {
  return `---
slug: sample-problem
title: Sample Problem Title
difficulty: Medium
tags:
  - array
  - hash-table
time_limit_ms: 1000
memory_mb: 256
contest_label: A
points: 100
checker_type: token
---

# Sample Problem Title

Given an array of integers \`nums\` and an integer \`target\`, return the answer according to the problem requirements.

### Example 1:
**Input:** nums = [2, 7, 11, 15], target = 9
**Output:** [0, 1]
**Explanation:** Because nums[0] + nums[1] == 9, we return [0, 1].

### Example 2:
**Input:** nums = [3, 2, 4], target = 6
**Output:** [1, 2]

### Constraints:
- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`

### Sample Test 1
\`\`\`input
4 9
2 7 11 15
\`\`\`
\`\`\`output
0 1
\`\`\`

### Sample Test 2
\`\`\`input
3 6
3 2 4
\`\`\`
\`\`\`output
1 2
\`\`\`

### Hidden Test 1
\`\`\`input
2 6
3 3
\`\`\`
\`\`\`output
0 1
\`\`\`
`;
}
