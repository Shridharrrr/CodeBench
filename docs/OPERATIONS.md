# CodeBench Production Operations & Runbook

This document outlines the standard operating procedures, failure scenarios, and operational runbooks for running CodeBench in production collegiate competitions and high-stakes algorithmic CTFs.

---

## 1. System Topology & Production Deployment

```
                    +--------------------+
                    |  Cloudflare / WAF  |
                    +---------+----------+
                              |
                    +---------v----------+
                    | Traefik / Nginx LB |
                    +---------+----------+
                              |
                +-------------+-------------+
                |                           |
        +-------v-------+           +-------v-------+
        | codebench-api |           | codebench-api |
        |  (Instance 1) |           |  (Instance 2) |
        +-------+-------+           +-------+-------+
                |                           |
                +-------------+-------------+
                              |
                +-------------v-------------+
                |      PostgreSQL 17        |
                |    (Primary + Standby)    |
                +---------------------------+
                              ^
                              | NATS JetStream 2.10
                              v
        +---------------------+---------------------+
        |                                           |
+-------v-------+                           +-------v-------+
|  Judge Node 1 |                           |  Judge Node 2 |
| (Bare Metal)  |                           | (Bare Metal)  |
+---------------+                           +---------------+
```

### Infrastructure Recommendations
- **API Nodes:** 2 vCPU, 4GB RAM minimum (Go runtime, embedded NATS JetStream, SSE connection broker).
- **Judge Nodes:** Bare-metal dedicated instances preferred (e.g. AMD EPYC / Ryzen 9) with CPU frequency pinning to prevent turbo-boost throttling. Minimum 4 physical cores, 16GB RAM.
- **Database:** PostgreSQL 17 with SSD / NVMe storage for fast outbox writes.

---

## 2. Health Monitoring & Observability

### Healthcheck Endpoint (`GET /healthz`)
- Used by container orchestrators (Kubernetes / Docker Compose) and load balancers.
- Verifies:
  - PostgreSQL database connectivity via `SELECT 1`.
  - NATS JetStream broker liveness.
- Expected HTTP status: `200 OK`.

### Prometheus Metrics Endpoint (`GET /metrics`)
Exposes operational telemetry formatted for Prometheus scraping:
- `codebench_submissions_total{language, verdict}`
- `codebench_queue_latency_seconds_bucket`
- `codebench_execution_time_seconds_bucket`
- `codebench_active_sse_clients`
- `codebench_canary_jitter_ratio`

---

## 3. Canary Timing Calibration Runbook

### Purpose
Virtual machines and cloud instances frequently experience CPU steal-time or neighbor throttling. The Timing Canary continuously benchmarks a synthetic workload. If execution time deviates by more than 15%, the judge applies a dynamic calibration multiplier.

### Manual Canary Calibration via CLI
Before starting an official competition, calibrate the baseline on your judge nodes:

```bash
# 1. SSH into the judge host
ssh admin@judge-01.internal

# 2. Run calibration with 30 iterations
codebench tune --samples 30 --tolerance 0.12

# Output example:
# [INFO] Running baseline calibration pass (30 samples)...
# [INFO] Sample 1: 14.2ms
# [INFO] Sample 2: 14.1ms
# ...
# [INFO] Mean Baseline: 14.18ms, StDev: 0.14ms (Jitter: 0.98%)
# [INFO] Calibration recorded successfully. Threshold tolerance locked at 12%.
```

---

## 4. Disaster Recovery & Backup Runbook

### Scheduled Backups
CodeBench includes an automated backup mechanism that archives:
- PostgreSQL database dumps.
- Problem package manifests and hidden test vectors.
- Audit logs and submission histories.

```bash
# Trigger an immediate compressed snapshot
codebench backup --out /var/backups/codebench-$(date +%Y%m%d_%H%M%S).cbk

# Verify backup integrity
codebench backup --verify /var/backups/codebench-20261020_223000.cbk
```

### Recovery from Backup
In the event of database corruption or hardware failure:

```bash
# 1. Stop active API server
docker compose stop api

# 2. Restore PostgreSQL state from archive
codebench restore --archive /var/backups/codebench-20261020_223000.cbk --db "postgres://codebench:secret@localhost:5432/codebench?sslmode=disable"

# 3. Start API server and rebuild in-memory standings cache
docker compose start api
```

---

## 5. Adding Remote Bare-Metal Judge Nodes

To scale evaluation throughput during high-concurrency rounds, external judge workers can join the cluster:

```bash
# On the remote judge node:
codebench addjudge \
  --nats-url nats://token@api.codebench.internal:4222 \
  --concurrency 4 \
  --cgroups-root /sys/fs/cgroup \
  --cache-dir /var/cache/codebench
```

The node will automatically advertise its worker capabilities, register with the fair-share submission queue, and begin executing jobs.

---

## 6. Scoreboard Freeze & Unfreeze Protocol

1. **Freeze Window Execution:**
   - At the configured `freeze_at` time (typically `T - 60min`), the public standings view stops revealing solve indicators.
   - Competitors see `PENDING` or `ATTEMPTED` badges on submissions made during the freeze.
   - The administrative scoreboard continues to show real-time unblinded results for verification.

2. **Post-Contest Unfreeze Ceremony:**
   - Once all post-contest rejudges or disputed appeals are finalized:
   - Navigate to **Admin Dashboard -> Schedule & Controls**.
   - Click **Unfreeze Scoreboard**.
   - The platform broadcasts a `leaderboard_update` SSE event that automatically triggers celebratory solve reveals across all participant screens.
