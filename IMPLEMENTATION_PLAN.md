# Codebench Implementation Plan

This document turns `PLAN.md` into an executable build plan. The repository is
starting from the blueprint only, so implementation begins with a small,
testable vertical slice before expanding into the complete judge, contest, and
operations platform.

## Launch target

- Linux hosts are the production and contest-grade target.
- Docker Desktop on macOS and Windows is supported for development and
  practice.
- Docker Desktop receives a timing-quality warning and is not suitable for
  contest-grade timing.
- A clean clone must work with Docker and Compose as the only prerequisite.

## 1. Architecture decisions to lock first

Record these decisions as ADRs under `docs/adr/` before the related code is
implemented.

### Trust boundaries

1. **Browser**: may see statements, samples, public metadata, verdicts, and
   usage summaries. It must never receive hidden test input/output, reference
   solutions, or checker internals.
2. **API**: authenticates users and validates submissions. It owns PostgreSQL
   writes and NATS publication. It does not execute participant code.
3. **Judge**: receives authenticated jobs, retrieves immutable problem packages
   by hash, and executes compiler, participant, and checker processes only
   through the Rust sandbox.
4. **Host kernel**: enforces cgroups, namespaces, seccomp, Landlock, and
   process termination and is part of the security boundary.

If required kernel primitives are unavailable, the judge must refuse execution
and report an unavailable-host condition. It must never fall back to an
unsandboxed `fork/exec` path.

### Delivery semantics

Use at-least-once delivery with idempotent processing:

- PostgreSQL is the source of truth.
- NATS JetStream transports jobs and verdicts.
- Every job carries a unique `submission_id` and `attempt_id`.
- Verdict persistence is idempotent by submission and attempt.
- A redelivered job with a terminal verdict is acknowledged without re-running.
- A stale job lease is recoverable by a sweeper.
- Duplicate delivery must never create duplicate score events or duplicate
  `submission_results`.

The system should guarantee exactly-once observable results rather than claim
exactly-once processing across PostgreSQL, NATS, and process crashes.

### Input handling

Every test case receives its own input file descriptor or memory-backed file:

```text
test case input -> sandbox stdin
participant stdout -> capped output buffer
participant stderr -> capped diagnostic buffer
```

Hidden tests must never be concatenated into one input stream unless the
problem explicitly defines a multi-case format.

### Complexity enforcement

An in-process call counter is not an independent security boundary for
arbitrary native code. A malicious submission can alter symbols, inspect
memory, bypass wrappers, or avoid the counter.

Use these enforcement levels:

- Production-grade exact enforcement: a separate interactor process with a
  query protocol and a query budget.
- Restricted function harness: only for explicitly constrained package types
  with documented limitations.
- Scaling analysis: supporting evidence and diagnostics, never a mathematical
  proof.
- Publish gate: deliberately wrong solutions must fail before a problem version
  can be published.

### Host compatibility

| Grade | Environment | Use |
|---|---|---|
| A | Tuned Linux bare metal or equivalent VM | Contests and interviews |
| B | Linux with default scheduling | Practice and casual contests |
| C | Docker Desktop on macOS or Windows | Development and practice |

Docker Desktop runs the judge inside a Linux VM. The judge must verify cgroup
v2, namespaces, seccomp, Landlock, perf support, and required mount privileges
from inside the actual judge container.

## 2. Repository structure

```text
codebench
├── codebench                 # POSIX bootstrap wrapper
├── codebench.ps1             # PowerShell bootstrap wrapper
├── compose.yaml
├── compose.dev.yaml
├── Dockerfile
├── Makefile
├── README.md
├── .env.example
├── .nvmrc
├── go.mod
├── go.sum
├── Cargo.toml
├── Cargo.lock
├── package.json
├── package-lock.json
├── buf.yaml
├── buf.lock
├── proto/
├── api/
│   ├── cmd/codebench-api/
│   ├── internal/
│   │   ├── auth/
│   │   ├── contests/
│   │   ├── problems/
│   │   ├── scoring/
│   │   ├── submissions/
│   │   ├── standings/
│   │   └── events/
│   ├── adapters/
│   │   ├── postgres/
│   │   ├── nats/
│   │   └── http/
│   └── migrations/
├── judge/
│   ├── Cargo.toml
│   ├── sandbox/
│   ├── pipeline/
│   ├── compiler/
│   ├── checker/
│   ├── agent/
│   └── protocol/
├── web/
│   ├── src/
│   ├── public/
│   └── tests/
├── cli/
├── problems/
├── tools/
├── deploy/
│   ├── api.Dockerfile
│   ├── judge.Dockerfile
│   ├── caddy/
│   ├── systemd/
│   └── host-tuning/
├── tests/
│   ├── integration/
│   ├── escape-corpus/
│   ├── differential/
│   ├── load/
│   └── fixtures/
├── docs/
│   ├── adr/
│   ├── threat-model.md
│   ├── quickstart.md
│   ├── writing-problems.md
│   ├── operating-contest.md
│   └── runbooks/
└── .github/workflows/
```

Use Go modules, a Rust workspace with `Cargo.lock`, an npm lockfile, pinned
protobuf tooling, and Dockerfiles that install all required system packages.

## 3. Building phases

### Phase 0 — Architecture, threat model, and contracts

#### Objective

Turn the blueprint into stable interfaces before implementing business logic.

#### Work

Create ADRs for:

1. Sandbox trust boundary and kernel requirements.
2. Embedded NATS lifecycle and persistence.
3. PostgreSQL as source of truth.
4. Transactional outbox and idempotent verdict processing.
5. Immutable problem versions.
6. C/C++ compiler profiles and toolchain pinning.
7. Server-Sent Events delivery and reconnection.
8. Docker Desktop compatibility and timing grades.
9. Complexity enforcement.
10. Backup and restore format.

Define the submission and contest state machines, verdict taxonomy, NATS
subject naming, API error format, authentication/session model, problem
package schema, toolchain manifest, metrics naming conventions, and audit event
vocabulary.

#### Exit gate

- ADRs reviewed.
- OpenAPI specification created.
- Protobuf message schemas compile for Go and Rust.
- State transitions include valid and invalid transitions.
- Threat model identifies assets, attackers, trust boundaries, mitigations,
  and residual risks.

### Phase 1 — Repository foundations and the first vertical slice

#### Objective

Make a clean clone runnable with one command and prove the control-plane
message flow.

#### Workstreams

##### Repository and tooling

- Pin Go, Rust, Node, and judge toolchain versions.
- Add `make test`, `make lint`, `make build`, `make dev`, `make integration`,
  `make e2e`, and `make security`.
- Add Dockerfiles for API, judge, web build, and development.
- Add `.env.example` and runtime secret generation.
- Add CI for formatting, tests, Docker builds, and dependency audits.

##### Bootstrap CLI

Implement:

```text
./codebench up
./codebench doctor
./codebench dev
./codebench down
```

Provide a PowerShell equivalent for Windows Docker Desktop. The bootstrap
flow checks Docker and Compose, checks free ports and available memory, starts
PostgreSQL and the API, starts embedded NATS JetStream, applies migrations,
seeds a demo problem and account, starts the judge, and prints the URL and
timing grade.

##### API and database skeleton

Implement health/readiness endpoints, PostgreSQL migrations, embedded NATS
startup, structured logging, request IDs, an outbox relay, a verdict consumer,
and a fake judge adapter used only by tests.

##### First end-to-end flow

```text
POST test submission
  -> PostgreSQL submission row
  -> PostgreSQL outbox row
  -> NATS JetStream job
  -> fake judge
  -> NATS verdict
  -> PostgreSQL verdict update
  -> SSE event
```

#### Exit gate

A clean machine with Docker can run `./codebench up`; a sample submission is
accepted; a failed submission receives deterministic `WA`; API restarts do not
lose jobs; duplicate verdicts are harmless; SSE delivers the verdict; metrics
are exposed; and `make test` works without external services.

### Phase 2 — Native Rust sandbox and judge core

This is the highest-risk phase and must be completed before enabling real
participant execution.

#### Objective

Execute hostile C/C++ compiler and runtime processes inside a verifiable
sandbox.

#### Workstream 2A — Kernel capability probe

Check cgroup v2, memory and CPU accounting, pids and cpuset support, user/mount/
PID/network/IPC/UTS namespaces, `clone3`, `CLONE_INTO_CGROUP`, pidfds, epoll,
seccomp, Landlock, `perf_event_open`, and required filesystem mount operations.

Expose the result through the CLI and an internal host-capability endpoint.

#### Workstream 2B — Sandbox profiles

Implement separate `compile`, `run`, `checker`, and `interactor` profiles. Each
profile defines memory, CPU, wall-clock, output, stack, file-size, open-file,
process/thread, filesystem, network, and perf policies.

#### Workstream 2C — Process and resource isolation

The native runner must set limits before process creation, spawn through
`clone3`, enter the required namespaces, mount a read-only toolchain, pivot to
a minimal tmpfs root, apply `no_new_privs`, drop capabilities, apply seccomp
and Landlock, supervise with pidfd and epoll, kill the complete cgroup on a
breach, collect usage, and quarantine broken slots.

#### Workstream 2D — I/O

Use memfd or tmpfs for input, capped descriptors for stdout and stderr, bounded
diagnostics, and explicit output-limit reporting.

#### Workstream 2E — Compiler and pipeline

Support `cpp23-gcc`, `cpp23-clang`, `c23-gcc`, and `c23-clang`. Compile inside a
compile sandbox. The pipeline is:

```text
prepare -> compile -> run tests -> check outputs -> aggregate -> publish
```

Compiler flags belong to immutable compiler profiles rather than being embedded
throughout the pipeline.

#### Workstream 2F — Reference adapter

Implement an `isolate` adapter behind the same `Sandbox` trait for behavior,
timing, and regression comparisons. Production execution must still require an
approved sandbox.

#### Test corpus

Cover fork and thread bombs, memory and stack exhaustion, output floods,
infinite loops, syscall probes, `/proc` and `/sys`, networking, ptrace,
mounts, setuid/setgid, file traversal, compiler include abuse, assembler and
linker abuse, and malformed package paths.

#### Exit gate

The escape corpus passes on supported Linux runners; native and `isolate`
verdicts agree; usage remains within tolerance; hidden files are inaccessible;
missing primitives fail closed; repeated same-host runs have stable CPU timing;
and judge crashes safely redeliver jobs.

### Phase 3 — Problem package system

#### Objective

Make problems reproducible, immutable, testable, and safe to publish.

Define and validate `problem.yaml`, including slug, version, title, difficulty,
tags, languages, limits, checker, complexity policy, and test groups. Reject
duplicate YAML keys, path traversal, symlinks, oversized files, invalid tests,
unsupported checkers, and invalid limits.

Implement:

```text
./codebench problems validate ./problems/example
./codebench problems import ./problems/example
```

The publish pipeline parses the package, validates every input, builds and runs
the reference solution, cross-checks small cases with an independent solution,
runs all deliberate wrong solutions, computes the package hash, creates an
immutable problem version, and stores hidden artifacts in judge-only storage.

Support token, floating-point, special, and interactive checkers. Checker
failures are `SE`.

#### Exit gate

At least ten sample/reference problems pass validation. Every published problem
has wrong solutions that fail for the intended reason, hidden files are never
returned by browser-facing endpoints, and edits create new immutable versions.

### Phase 4 — Submission API and frontend

#### Objective

Deliver the first user-facing flow: browse a problem, edit code, run samples,
submit, and observe a verdict.

Implement authentication, problem listing, problem detail, sample/custom run,
submission, submission detail, and submission-event endpoints. A submission
transaction authenticates the user, resolves the immutable version, validates
language/source size and contest eligibility, inserts `QUEUED`, inserts an
outbox job, commits, and returns the ID.

Use Argon2id, secure HTTP-only same-site sessions, hashed session tokens, CSRF
protection, rate limits, strict CSP, request limits, redacted logs, and audit
entries for administrative actions.

Implement authenticated SSE with `Last-Event-ID`, durable event replay,
heartbeats, reconnect-safe ordering, bounded client buffers, and connection
metrics.

The SolidJS frontend uses Vite, Tailwind, CodeMirror 6, TanStack Query for
Solid, OpenAPI-generated types, Markdown/KaTeX, keyboard navigation, local
draft autosave, theme support, and virtualized leaderboard rows.

#### Exit gate

A user completes the full submission flow; compile diagnostics are usable; Run
never exposes hidden tests; Submit shows all lifecycle states; SSE reconnects
without losing the final verdict; crash tests lose and duplicate nothing; and
browser tests cover keyboard navigation and submission.

### Phase 5 — Fixed contest engine

Implement contest creation, immutable problem lists, ten selected problems,
server-authoritative timing, joining, scoring strategies, penalty rules,
freeze/unfreeze, contest-specific visibility, administration, and audit logs.

Define a pure scoring interface and implement ICPC, points, optional decay, and
partial group scoring. PostgreSQL submissions remain the source of truth;
in-memory standings are rebuilt after restart and updated only after committed
database transactions.

#### Exit gate

A simulated 100-user contest matches a reference scorer; client time cannot
extend the contest; freeze hides intended information; restart rebuilds the same
standings; duplicate verdicts do not double-count; and contest problems remain
unchanged after start.

### Phase 6 — Practice mode and complexity enforcement

Practice mode supports count, difficulty, tags, solved-problem exclusion,
optional timers, private standings, history, and stored random seeds. It uses
the same `Contest` domain model and scoring pipeline.

Complexity enforcement proceeds in this order:

1. Separate-process query-budget interactors.
2. Restricted function harnesses with documented limitations.
3. Retired-instruction scaling analysis as a supporting report.

#### Exit gate

Every problem with a complexity policy has wrong solutions that fail; query
budgets are enforced outside the participant process; hidden contents are not
revealed; and practice shares domain code with fixed contests.

### Phase 7 — Performance, reliability, and operations

Add content-addressed compile caching, PCH, fast linking, preloaded test input,
slot pools, separate compile/run pools, priority lanes, fail-fast ordering,
parallel first-pass judging, serial borderline-TLE reruns, and hardware-class
routing.

Implement `./codebench tune` and `./codebench tune --undo` with confirmations,
reversible state, reboot guidance, CPU governor checks, swap checks, SMT checks,
isolated-core support, and Docker Desktop safeguards.

Add outbox retries, stale-job sweeping, judge heartbeats, slot quarantine,
bounded retries, rejudge batches, graceful judge drain, NATS persistence,
backup/restore, and upgrade runbooks.

Export queue depth, stage latency, cache hits, sandbox errors, quarantines,
verdicts, database lock waits, NATS redeliveries, SSE connections, hardware
health, and canary timing metrics.

#### Exit gate

The documented SLOs hold on a Grade A host, kill/restart tests lose zero
submissions, duplicate deliveries produce zero duplicate terminal outcomes,
restore drills recover staging, and one-command rejudge works for a submission,
problem version, and contest.

### Phase 8 — Security review and release hardening

Complete threat-model review, native-runner review, external sandbox review or
red-team testing, escape-corpus CI, parser and configuration fuzzing, dependency
and image scans, capability review, hidden-data review, rate-limit testing, and
session/CSRF/database authorization testing.

Release signed multi-architecture images, SBOMs, provenance attestations,
pinned base-image digests, and pinned toolchain digests. Upgrade by backing up,
draining judges, applying migrations, upgrading judges one at a time, running a
canary submission, and then resuming traffic.

Run the setup acceptance test on Linux x86_64, Linux arm64, Docker Desktop on
macOS, and Docker Desktop on Windows.

## 4. Recommended implementation order

Three tracks can proceed after Phase 0:

### Judge track

```text
Phase 2 -> compiler -> checkers -> performance -> security
```

### API/control-plane track

```text
Phase 1 -> database/outbox -> submissions -> contests -> practice
```

### Frontend track

```text
Phase 1 contracts -> problem page -> submissions -> contest UI -> practice UI
```

The frontend and API may use a fake judge in tests, but production configuration
must only enable an approved sandbox implementation.

## 5. Definition of done for every phase

Every phase includes implementation code, unit and integration tests, migrations
where needed, structured logs and metrics for new workflows, documentation,
Docker build verification, lockfile updates, `make test` passing, no secrets or
machine-specific paths, an updated acceptance checklist, and a focused git
commit.

The primary development command is:

```text
make test
```

It must run deterministic, offline-capable unit, protocol, package, and
integration tests. Privileged sandbox tests, Docker Desktop acceptance tests,
load tests, and external security scans have explicit targets and run in the
appropriate CI environments.

## 6. First implementation slice

1. Bootstrap repository and pinned toolchains.
2. Start PostgreSQL and API with Docker Compose.
3. Start embedded NATS JetStream.
4. Add users, problems, submissions, outbox, and submission events.
5. Add a fake judge for control-plane tests.
6. Add one sample C++ problem.
7. Add the Rust sandbox capability probe.
8. Replace the fake judge with a native sandbox for one C++ compile/run/check
   path.
9. Expose verdicts through SSE.
10. Add the first SolidJS problem page.
11. Verify `AC`, `WA`, `CE`, `TLE`, and `RE`.
12. Run crash and redelivery tests.

This creates a complete, testable product foundation while keeping the
highest-risk sandbox work behind a stable interface.
