# ADR 0004: Transactional Outbox and Idempotent Verdict Processing

## Status
Accepted

## Context
Submissions cannot be lost if the API crashes between writing to the database and publishing to NATS. Similarly, network partitions or rejudges could cause duplicate delivery of judge jobs or verdicts.

## Decision
1. **Transactional Outbox Pattern**:
   - Submission creation inserts the submission row (`status = QUEUED`) and an outbox entry (`subject = jobs.submissions`, payload = JSON/Proto) in the **same database transaction**.
   - An asynchronous outbox relay process polls or watches the outbox table, publishes pending records to NATS JetStream, and marks them `published_at = NOW()`.
2. **Idempotent Verdict Consumption**:
   - Every submission carries a unique `submission_id` and `attempt_id`.
   - Verdict consumer handles messages idempotently: if a submission is already terminal in PostgreSQL, incoming duplicate verdicts are acknowledged without overwriting or generating duplicate score events.
   - Stale job leases are cleaned up by a queue sweeper after lease expiration.

## Consequences
- At-least-once message delivery yields exactly-once observable results in database and UI.
- API and worker crashes cause zero lost submissions.
