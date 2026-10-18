# ADR 0003: PostgreSQL as Source of Truth

## Status
Accepted

## Context
Codebench handles contest scores, submissions, problem statements, user accounts, and audit events. Distributed caches or queues can crash or drop messages.

## Decision
1. PostgreSQL is the sole authoritative source of truth for all durable application state.
2. Every state change (submission creation, verdict arrival, contest freeze, standings recalculation base) is committed to PostgreSQL with ACID guarantees.
3. In-memory data structures (such as live leaderboards) are purely ephemeral read models that are deterministically rebuilt from PostgreSQL on startup or reconnection.

## Consequences
- Guaranteed data consistency across judge or API worker restarts.
- Backups and disaster recovery need only target PostgreSQL and problem file packages.
