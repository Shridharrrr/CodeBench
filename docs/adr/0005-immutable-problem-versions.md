# ADR 0005: Immutable Problem Versions

## Status
Accepted

## Context
When a contest is active, an author or administrator editing a test case, statement typo, or time limit must never silently mutate the problem under live submissions. Furthermore, rejudging past contests requires the exact test cases and limits that existed at that moment.

## Decision
1. Problems have a parent record (`problems`) with a slug, and versioned children (`problem_versions`).
2. Every version contains an immutable snapshot of limits, checker configurations, complexity policy, and SHA-256 package hash.
3. Contests and submissions link directly to a specific `problem_version_id`.
4. Updating a problem imports a new immutable version.

## Consequences
- Guarantees historical reproducibility and uncompromised contest integrity.
- Safe rejudging against specific historical test sets.
