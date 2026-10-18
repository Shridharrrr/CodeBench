# ADR 0010: Backup and Restore Format

## Status
Accepted

## Context
Codebench self-hosted deployments must support single-command backup and restore without complex external orchestration.

## Decision
1. Backups consist of a single compressed archive (`tar.gz`) containing:
   - Consistent PostgreSQL database dump generated via `pg_dump --format=custom`.
   - Manifest file (`manifest.json`) containing system version, timestamp, package hashes, and timing grade.
   - Immutable problem package directories (`problems/`).
2. Restore validates archive integrity, restores the PostgreSQL database schema and data, and unpacks problem definitions into the target storage directory.

## Consequences
- Fast, reproducible backup/restore operations via `./codebench backup` and `./codebench restore <file>`.
