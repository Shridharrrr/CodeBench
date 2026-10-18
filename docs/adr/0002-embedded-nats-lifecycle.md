# ADR 0002: Embedded NATS Lifecycle and Persistence

## Status
Accepted

## Context
A competitive programming judge requires a fast, low-latency, durable messaging backbone to distribute jobs to judge daemons and stream verdicts back to the API. Operating an external Redis or standalone NATS cluster complicates the "git clone && ./codebench up" single-command goal.

## Decision
1. Embed the NATS JetStream server directly inside the Go API binary using `github.com/nats-io/nats-server/v2/server`.
2. JetStream streams (`SUBMISSIONS`, `VERDICTS`) will use file-based storage or memory storage backed by PostgreSQL state.
3. The API and embedded NATS share a lifecycle: NATS starts synchronously on API startup before HTTP listeners open, and shuts down gracefully upon SIGTERM.

## Consequences
- Single binary operation with zero external broker dependencies.
- Sub-millisecond queue dispatch without network hops between the API and the broker.
