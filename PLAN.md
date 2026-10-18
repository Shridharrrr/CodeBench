# Codebench: Production Blueprint for a Local C/C++ Judge Platform

Codebench is a self-hosted coding interview and competition platform. This is its production-grade blueprint. The stack is Go and Rust for speed and a small memory footprint, with a TypeScript frontend: sandboxed C/C++ execution, hidden tests, enforced complexity, two contest modes and a clean UI.

## 1. Goals and the Honest Hard Parts

**Requirements**

- Self-hosted on one machine or a LAN (college lab, company, club).
- Latest C and C++ (GCC 15+ / Clang latest, `-std=c++23`, C23).
- Visible samples plus hidden test cases.
- Enforce the intended complexity (a linear scan must not pass a binary search problem).
- Mode A: fixed set of 10 questions, one total timer, live leaderboard.
- Mode B: free practice with any number of questions, filtered by difficulty and tags.
- Fast: low queue latency, fast compile, parallel test execution.

**Top priority: setup.** People will run this by cloning the repo, so `git clone` followed by one command (`./codebench up`) must produce a working platform: one prerequisite (Docker with Compose), no manual configuration, no language toolchains on their machine. Every design choice below is checked against this; Section 13 specifies it.

**Production requirements**

- Latency targets (confirm by load test): under 100 ms from submit to the start of compilation on an idle judge; a cached-compile submission with sample-sized tests judged in under 1 s.
- Timing fairness: the same program gets the same CPU time within a few percent on any judge host of the same hardware class.
- Reliability: no lost or duplicated submissions on a worker crash, API restart or network blip; every submission reaches a terminal verdict.
- Footprint: the control plane (API, database, queue, proxy) runs comfortably on a small VM; RAM is spent on sandboxes, not on the platform.
- Operability: metrics, structured logs, backups with tested restores, one-command rejudge, safe rolling upgrades.
- Security: hostile code is assumed; hidden tests and answers never reach a participant sandbox or browser.

**The three genuinely hard parts**

1. **Sandboxing**: running untrusted native code safely. Never use plain `fork/exec`. Use a purpose-built sandbox.
2. **Accurate measurement**: CPU time and memory must be measured by the kernel (cgroups), not by wall-clock in your own process.
3. **Complexity enforcement**: no system can mathematically prove complexity. You can only make wrong complexity fail reliably through problem design plus measurement. Section 5 covers this in depth because it is your most important requirement.

**Build vs reuse.** Study **DOMjudge**, **CMS**, **DMOJ**, **Judge0** and the **isolate** sandbox. For a production platform with these requirements, build the web app, contest engine and problem format yourself, and write a native Rust sandbox runner on kernel primitives (cgroups v2, namespaces, seccomp, Landlock). Keep `isolate` as a second adapter and as the reference oracle the runner is tested against. Do not ship a sandbox that has not been attacked: Section 12 lists the verification required.

## 2. High-Level Architecture

```
Browser (TypeScript SPA, static files)
   |  HTTPS, REST + SSE
Caddy (TLS, HTTP/2, compression)
   |
codebench-api (Go, one static binary, modular monolith) --- PostgreSQL (source of truth)
   |  transactional outbox -> publish jobs / consume verdicts
NATS JetStream (durable work queue + pub/sub)
   |
codebench-judge (Rust daemon per judge host, one slot per pinned core)
   |  compile (cached) -> native sandbox run -> checker
   v
verdict -> NATS -> codebench-api -> Postgres -> SSE to browsers
```

Run the **API and the judge as separate processes**, and on separate hardware for any serious contest. The judge's timing-critical cores are pinned and isolated from the scheduler; nothing else (web server, database, browsers, log shippers) may run on them. More capacity means starting `codebench-judge` on another host of the same hardware class, pointed at the same NATS server.

## 3. Recommended Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | TypeScript, **SolidJS** (Svelte 5 is equivalent), Vite, Tailwind, **CodeMirror 6** (Monaco as a lazy-loaded option) | Small bundles and fine-grained reactivity with no virtual DOM, so old lab PCs stay responsive; the build is embedded in the Go binary |
| Live updates | Server-Sent Events over HTTP/2 | One-way verdict and leaderboard streams, automatic reconnect, no WebSocket state to manage |
| API | **Go**, standard `net/http` with `chi`, `pgx`, `sqlc`, `slog` | Static binary, low memory, fast startup, simple concurrency; a modular monolith, not microservices |
| Judge | **Rust**: `rustix`/`libc`, `seccompiler`, `landlock`, `perf-event`; `tokio` for the control plane only | No GC pauses on the timing path, direct syscalls, memory safety in the component that handles hostile input |
| Database | **PostgreSQL** (current stable), `goose` or `atlas` migrations | Transactions for scoring, constraints, point-in-time recovery |
| Queue and events | **NATS JetStream** | Durable work-queue streams with ack and redelivery, pub/sub for events; runs embedded inside the Go API, so there is no extra service to install; replaces Redis |
| Leaderboard | In-memory standings in the API, rebuilt from Postgres, pushed over SSE | No extra service; sorting thousands of rows takes microseconds |
| Problem tools | C++ with **testlib.h** (checkers, validators, generators), built once and cached | Industry standard and off the hot path |
| Toolchains | Latest GCC and Clang, pinned per problem, shipped as a read-only erofs or squashfs image | Reproducible builds, identical on every judge host |
| Observability | Prometheus-format metrics, VictoriaMetrics + Grafana, `slog` JSON logs to journald | Low overhead; shows queue depth, stage latency, sandbox errors |
| Edge | Caddy | TLS, HTTP/2, compression, static caching |
| Deployment | Docker Compose by default (one command via the codebench CLI); static binaries under **systemd** for tuned bare-metal judge hosts | Clone-and-run for everyone, with a tuned path when timing accuracy matters |

**Why not Redis, Node or Python?** NATS covers queueing and fan-out in one small binary, and the leaderboard is a small in-process structure with Postgres as the source of truth. Node or Python would add memory and runtime overhead to the API for no gain, while Go holds thousands of SSE connections cheaply. Rust is non-negotiable only for the judge. If your team prefers one language end to end, the API can also be Rust (axum + sqlx) without changing the architecture.

## 4. The Judge Engine (Core)

### 4.1 Submission lifecycle

Model it as an explicit **state machine**:

`QUEUED -> COMPILING -> RUNNING -> JUDGING -> DONE`

Terminal verdicts: `AC`, `WA`, `TLE`, `MLE`, `RE`, `CE`, `OLE` (output limit), `SE` (system error, never blamed on the user), `COMPLEXITY_FAIL`.

### 4.2 Compilation

```
g++ -std=c++23 -O2 -pipe -static -s -DONLINE_JUDGE -o sol sol.cpp
```

- `-O2` is the standard contest level. Use the same flags for the reference solution so time limits are fair.
- `-static` removes dynamic linker overhead and lets the sandbox run with almost no filesystem.
- Compile inside a sandbox too (compilers can be abused with `#include '/etc/passwd'` tricks and huge template expansion). Limit compile to about 10 s, 512 MB, and cap output size.
- Block dangerous includes and `#pragma` abuse only as defense in depth; the real protection is the sandbox.

### 4.3 Native Rust Sandbox Runner

The sandbox is a Rust crate behind a `Sandbox` trait. Production uses the native runner described below; `isolate` stays as a second implementation and the **reference oracle**. For comparison, this is the isolate invocation the native runner must match in behaviour:

```
isolate --cg -b 7 --init
isolate --cg -b 7 --run -t 1.0 -w 3.0 -m 262144 -f 65536 -p1 \
   -i input.txt -o output.txt --meta meta.txt -- ./sol
isolate --cg -b 7 --cleanup
```

**The native runner** (`judge/sandbox`) must provide all of the following, each covered by an automated escape test:

- `clone3` with new PID, mount, network, IPC, UTS, user and cgroup namespaces and `CLONE_INTO_CGROUP`, so the child starts inside its limits and never runs an instruction outside them.
- A cgroup v2 per slot: `memory.max`, `memory.swap.max` set to 0, `pids.max` set to 1 for runs (compilation gets a higher limit), `cpuset.cpus` pinned to one core; read `cpu.stat` for exact CPU time and `memory.peak` for peak memory.
- A read-only root from an erofs or squashfs image; `pivot_root` into a tmpfs that holds only the binary and the input, so nothing from the host is visible.
- A **seccomp-BPF allowlist** per profile (compile, run, checker) with default action kill, **Landlock** as a second layer, `no_new_privs`, all capabilities dropped, `RLIMIT_CORE` 0, and explicit stack, file-size and open-file limits.
- Supervision with `pidfd` and `epoll`: on any limit breach, `cgroup.kill` ends the whole group at once.
- Input from a `memfd` or tmpfs file and output into a size-capped `memfd`, with no pipe copying for non-interactive problems.
- Retired user-mode instruction counts from `perf_event_open`, used for complexity fits and for deciding borderline TLE.

The `isolate` adapter implements the same trait. CI runs a corpus (fork bombs, memory bombs, syscall probes, `/proc` and `/sys` probes, output floods, ptrace attempts, timing loops) through both and fails on any difference in verdict or on measured usage drifting beyond a small tolerance.

**Slots.** Each worker thread owns a numbered slot: its cgroup, its pinned core, its tmpfs and its prebuilt mount-namespace template. Slots share no state, so a cleanup bug in one run cannot affect the next, and a slot that reports an error is quarantined and rebuilt.

### 4.4 Making it fast

This is where most of the performance is won.

1. **Precompiled headers.** Build a PCH per compiler version at worker start and keep it in tmpfs. `bits/stdc++.h` otherwise dominates compile time; measure the gain on your hardware.
2. **Fast linking.** Use `mold` or `lld` and static linking to cut the link step.
3. **Content-addressed compile cache.** Key = hash(source, compiler, flags); LRU in tmpfs. Resubmissions, reference solutions and checkers skip the compiler entirely.
4. **Separate compile and run pools.** Compilation is noisy, multi-threaded and memory hungry, so it never shares cores with timed runs. Timed runs use only pinned, isolated cores (`isolcpus`, `nohz_full`).
5. **tmpfs and memfd everywhere.** Preload each problem's tests into the page cache at contest start (`mmap` with `MAP_POPULATE`) and hand the sandbox a file descriptor, never a copy.
6. **Cheap spawn.** `clone3` into a pre-created cgroup and a prebuilt mount-namespace template from the slot pool, so spawn-to-exec costs well under a millisecond-scale budget (measure it).
7. **Pipeline overlap.** Compile submission N+1 while submission N runs its tests.
8. **Fail fast and order tests.** Samples first, then small, then max-size tests; kill a run the moment it passes the limit.
9. **Harness problems link, not compile.** Precompile the harness to an object file; compile only the participant's translation unit.
10. **Priority lanes.** Separate NATS subjects and consumers so sample `Run` jobs and contest submissions are served before practice submissions and rejudges, with weighted fairness per user.
11. **Host tuning.** `performance` governor, SMT siblings off on judge cores, swap off, transparent hugepages set to madvise, NUMA-local memory, fixed CPU frequency where the hardware allows.

**Accuracy vs. throughput.** Running tests in parallel makes timings noisier because of shared cache and memory bandwidth. A good policy: run in parallel for a first quick verdict (everything that passes with a big margin), and re-run only borderline TLE cases alone, serially, on a quiet core before issuing a final TLE.

### 4.5 Fair timing

- Measure **CPU time from cgroup** (user + sys), not wall time.
- Set the time limit as `max(reference_time * k, floor)`, typically k = 2 to 3, and store it per problem and language (a C++ limit can be tighter than for slower languages if you add them later).
- Calibrate on your hardware: when a problem is published, run the reference solution automatically and record its time. If the server is under heavy load the calibration run will tell you the numbers are unreliable.

### 4.6 Checkers

Most problems compare tokens, but many need special judging (multiple valid answers, floating point, constructive problems).

- Default checker: token-wise compare ignoring trailing whitespace.
- Custom checker: `checker.cpp` built on **testlib.h**, receives `input`, `participant output`, `jury answer`, returns the verdict.
- Interactive problems: an `interactor.cpp` connected by pipes to the solution (the runner starts both in separate sandboxes and connects them with pipes).
- Always run the checker in its own sandbox with its own limits. A broken checker must produce `SE`, not WA.

## 5. Enforcing the Intended Complexity (Your Binary Search Problem)

Your concern is exactly right, and the reason it happens is subtle: **if the problem gives the array as input, reading the input is already O(n), so a linear scan and a binary search have the same total cost.** You cannot distinguish them by timing the whole program. Fix this at the problem-design level. Use several layers together.

### Layer 1: Many queries on preprocessed data (simplest, most common)

Give one array of N = 10^6 and Q = 10^6 queries. Binary search costs about Q log N = 2x10^7 operations. Linear search costs Q x N = 10^12, which is a guaranteed TLE. Reading input is O(N + Q), cheap. This single technique handles most data-structure and search problems and needs no special infrastructure.

### Layer 2: Function-style harness with an oracle (deterministic, exact)

Write a harness so the participant implements a function and never reads the data directly. Every access goes through an API that **counts calls**.

```cpp
// harness.h (given to participant)
int get(int i);        // returns A[i], increments a counter
int size();

// participant implements:
int find_index(int target);
```

The judge's `main` runs the participant function and, after it returns, compares `calls` against a budget such as `ceil(log2(N)) + 5`. Result: `COMPLEXITY_FAIL: used 100000 accesses, limit 25`. This is deterministic (not noisy like timing), gives the user a precise explanation, and works for binary search, search on rotated arrays, k-th element, etc.

The harness and participant code are compiled into one binary. To stop cheating (the participant calling internals), keep the counter in the harness's own translation unit with hidden symbols, and have the harness `main` run the verdict check; you can also run the harness as a **separate process** that talks to the solution over a pipe (an interactive problem), which makes cheating essentially impossible.

### Layer 3: Interactive problems with a query budget

The classic competitive-programming form: the solution may ask at most K questions to the interactor (e.g. 31 queries for a range of 10^9). Exceeding K is `WA` or `COMPLEXITY_FAIL`. Exact and unhackable.

### Layer 4: Scaling experiments (for algorithms where input must be read)

For problems like sorting or two-pointers where there is no oracle trick, measure how cost grows:

1. Generate worst-case inputs at sizes n, 2n, 4n, 8n, 16n.
2. Measure **retired instructions** (`perf_event_open` with `PERF_COUNT_HW_INSTRUCTIONS`, user mode only) or CPU time. Instruction counts are far more stable than wall time.
3. Fit a line on log-log axes. Slope about 1 means O(n) or O(n log n); slope about 2 means O(n^2); compare against the reference solution's curve.
4. Fail if the ratio `solution_cost / reference_cost` grows with n beyond a tolerance, or if the cost at the largest n exceeds the limit.

This is a **supporting signal and a hint to the user**, not proof. Note that n log n vs n is very hard to separate empirically; do not promise it.

### Layer 5: Adversarial test design

- Include maximum-size inputs at the constraint limit (the constraint is part of the complexity contract).
- Add anti-quadratic tests: sorted, reverse sorted, all equal, alternating, worst-case for naive pivot choice, hash-collision patterns, long chains for recursion, etc.
- Add anti-hash tests for `unordered_map` if relevant.
- Keep a pool of **deliberately wrong** solutions per problem (the naive O(n^2), the linear search, the O(n) memory version) and require that your **problem validation step** shows they all fail and the reference passes. A problem cannot be published until this check goes green. This is the single best quality gate you can build.

### Layer 6: Memory as complexity

Some problems want O(1) extra space. Use a tight memory limit (e.g. input size plus a few MB) so an O(n) extra array fails with MLE.

### What to tell your users

Show the complexity verdict with an explanation (`Used 1,000,000 array reads; this problem allows 25`). Transparency prevents arguments.

## 6. Problem Package Format

Store each problem as a folder (version it in git, import into the DB):

```
problems/two-sum-sorted/
  problem.yaml        # title, statement, limits, tags, difficulty, checker type
  statement.md        # Markdown + KaTeX math
  solution/ref.cpp    # reference (author) solution
  solution/wrong/     # deliberately wrong solutions that MUST fail
  gen/                # generators (testlib.h) + seed lists
  validator.cpp       # checks every input obeys constraints
  checker.cpp         # optional special judge
  tests/
    sample/01.in 01.out
    hidden/001.in 001.out ... (group-tagged)
  harness/            # optional function-style or interactive harness
```

**Hidden test cases.** Samples (about 1-3) are shown in the UI. Hidden tests live only on the server and are never sent to the client. On failure, show the failing test number and verdict, but **never** the hidden input/output (optionally show the first few characters of a small failing test in practice mode if the author permits it).

**Generating answers.** Run the reference solution on each input to produce the `.out`, and cross-check with a second independent solution (a brute force on small tests). Disagreement means a bug in a problem, caught before publishing.

**Test groups.** Group tests (small, medium, max, anti-naive, edge cases) so the UI can say `passed 38/40; failed group: max-size`.

## 7. Contest Modes

### Mode A: Fixed contest (same 10 questions for everyone)

- Admin creates a contest: pick 10 problems, start time, duration, scoring rule, penalty rule, freeze option.
- **Server-authoritative timer.** The client displays a countdown, but the server validates every submission timestamp. Never trust client time.
- **Scoring strategies** (plug-in via the Strategy pattern):
  - ICPC: rank by problems solved, tie-break by total penalty time (minutes to solve plus 20 per wrong attempt before the first AC).
  - Points: each problem has points (optionally decaying with time), partial scores by test group.
- **Leaderboard**: standings are held in memory in the API (sorted by solved, penalty, then time of last AC), updated in the same code path that commits an AC to Postgres, and pushed to browsers over SSE as diffs. On restart they are rebuilt from the `submissions` table, which stays the source of truth.
- Optional **freeze** in the last hour (display a stale board while judging continues), **unfreeze** by admin at the end.
- Anti-cheat basics: rate limit submissions, log tab visibility, and run a plagiarism check after the contest (token fingerprinting in the style of MOSS, or `jplag`).

### Mode B: Custom practice sets

- User picks: number of problems, difficulty range (Easy/Medium/Hard or a numeric rating), and tags (arrays, graphs, DP, ...). The server draws a random set **excluding problems already solved** and creates a private contest object with its own timer (optional).
- Reuse the same contest engine; the only difference is how the problem list is produced and that the leaderboard is private or optional.
- Rating system: start with static difficulty labels, later compute difficulty from acceptance rate, or use Elo-style per-problem ratings.

Because both modes are just a `Contest` with a problem list, a scoring strategy and a visibility rule, the code stays DRY.

## 8. Data Model (PostgreSQL)

```
users(id, name, email, password_hash, role)
problems(id, slug, owner_id)
problem_versions(id, problem_id, version, title, difficulty, tags[], time_limit_ms,
                 memory_mb, checker_type, complexity_policy jsonb, package_hash, published_at)
test_cases(id, problem_version_id, group, ordinal, input_path, output_path, is_sample)
contests(id, title, mode, starts_at, ends_at, scoring, freeze_at, owner_id)
contest_problems(contest_id, problem_version_id, label, points)
participants(contest_id, user_id, joined_at)
submissions(id, user_id, problem_version_id, contest_id null, language, source_hash,
            source, status, verdict, time_ms, memory_kb, instructions, failed_test,
            complexity_report jsonb, judge_host, created_at, judged_at)
submission_results(submission_id, test_id, verdict, time_ms, memory_kb)
outbox(id, subject, payload, created_at, published_at)
rejudge_batches(id, scope jsonb, requested_by, created_at)
audit_log(id, actor_id, action, target, at, detail jsonb)
```

Indexes: `(contest_id, user_id, problem_version_id)` on submissions, `(status, created_at)` for the queue sweeper. Store large test data on disk or tmpfs, not in the DB.

**Immutable problem versions.** A contest pins a `problem_version_id`. Editing a problem creates a new version, so a published contest never changes under participants and any submission can be rejudged against the exact tests it was judged with.

## 9. API Sketch

```
POST /api/auth/login
GET  /api/problems?difficulty=&tag=&q=
GET  /api/problems/:slug
POST /api/problems/:slug/submit          -> {submission_id}
GET  /api/submissions/:id                -> verdict + per-test results
GET  /api/contests/:id
POST /api/contests/:id/join
GET  /api/contests/:id/leaderboard
GET  /api/contests/:id/events            (SSE: verdicts, rank changes)
POST /api/practice/generate              {count, difficulty, tags}
POST /api/admin/problems/import          (upload problem package)
POST /api/admin/problems/:id/validate    (run reference + wrong solutions)
```

Submission flow: validate input and check the contest window, then in **one Postgres transaction** insert the `QUEUED` submission and an `outbox` row. A relay publishes the outbox row to a NATS JetStream work-queue stream (the transactional outbox pattern: nothing is lost if the API crashes between commit and publish). Return the ID immediately. Judge workers pull jobs, report the verdict, and ack only after it is persisted; an unacked job is redelivered, and verdict writes are idempotent by submission ID, so a crash produces neither a lost nor a duplicate result. Separate subjects give priority lanes: sample `Run` jobs and contest submissions ahead of practice submissions and rejudges.

## 10. Design Patterns and Where to Use Them

| Pattern | Where |
| --- | --- |
| **Hexagonal (Ports and Adapters)** | Core logic (contest rules, judge pipeline) knows only interfaces like `Sandbox`, `Compiler`, `JobQueue`, `Store`. Swap the native runner for `isolate`, or NATS for another broker, without touching business logic. |
| **Strategy** | Scoring (ICPC, points, decay), checker type (token, float, special, interactive), complexity policy (call budget, scaling fit), difficulty selection. |
| **State machine and typestate** | Submission and contest lifecycles. In Rust, encode the sandbox run as typestates (`Prepared`, `Running`, `Finished`) so illegal transitions do not compile. |
| **Transactional outbox** | Atomically record a submission and the job that must follow it, then relay to NATS. |
| **Idempotent consumer** | Every job handler and verdict write can be retried safely; redelivery is normal, not an error. |
| **Template Method / Pipeline** | Judge pipeline: `prepare, compile, for each test (run, check), aggregate, publish`. Languages override only compile and run. |
| **Factory / Registry** | A `LanguageRegistry` maps `cpp23`, `c23` to compile and run profiles; adding a language is configuration. |
| **Resource pool (slots)** | Pre-built sandbox slots with pinned cores; acquire, run, release or quarantine. |
| **Observer / Pub-Sub** | Verdict and rank events fan out to SSE connections and the standings updater. |
| **CQRS-lite** | Writes go to Postgres; the standings read model lives in memory and is rebuilt from the database. |
| **Backpressure and fair queueing** | Bounded queues, per-user rate limits and weighted lanes, so a flood cannot starve contestants. |
| **Repository** | Data access behind interfaces for testability. |

Project layout (monorepo):

```
codebench         thin wrapper script: ./codebench up
compose.yaml      default stack: api (with embedded NATS), postgres, judge, optional caddy
compose.dev.yaml  hot-reload development overrides
Makefile          make dev, make test, make release
.devcontainer/    ready-made development environment
/cli              Go: doctor, up, tune, backup, update, add-judge, problems import
/web              TypeScript SPA (Solid + Vite), built into /api/web/dist
/api              Go modular monolith: auth, problems, contests, scoring, submissions, SSE, embedded NATS
  /internal       domain packages behind interfaces (ports)
  /adapters       postgres, nats, http
/judge            Rust workspace
  /sandbox        namespaces, cgroups, seccomp, landlock, perf counters
  /pipeline       compile, run, check, aggregate; language registry
  /agent          NATS consumer, slot pool, metrics
/problems         sample problem packages (git), seeded on first run
/proto            shared schemas for NATS jobs and verdicts
/deploy           Dockerfiles, systemd units, Caddyfile, host tuning scripts
/tools            problem validator, load generator, rejudge CLI
/docs             quickstart, writing problems, operating a contest
```

## 11. Frontend (Clean Interface)

- **Problem page**: split view. Left: statement (Markdown rendered on the server, KaTeX for math), samples with copy buttons. Right: CodeMirror 6 editor with C/C++ support (lazy-loaded), language selector, Run (samples only) and Submit buttons, verdict panel.
- **Run vs Submit**: `Run` executes only custom or sample input and returns quickly; `Submit` runs the full hidden suite.
- **Contest page**: sticky top bar with countdown, problem tabs A to J colored by status (unsolved, attempted, solved), live leaderboard tab.
- **Verdict UX**: animate states `Queued, Compiling, Running test 7/40, Accepted`. Show compile errors with line links into the editor.
- **Performance budget** (targets): initial JS under about 100 KB gzipped excluding the editor chunk, route-level code splitting, virtualized rows for leaderboards of thousands, SSE diffs instead of refetching.
- Dark and light themes, keyboard shortcuts (Ctrl+Enter to run, Ctrl+Shift+Enter to submit), drafts autosaved locally.
- Tooling: TanStack Query for Solid, Tailwind, API types generated from the OpenAPI spec the Go API emits, Playwright for end-to-end tests.

## 12. Security Checklist

- Untrusted code runs only in the native sandbox (Section 4.3): no network, minimal read-only filesystem, one process, memory and CPU caps, seccomp allowlist, Landlock, no ptrace.
- The judge daemon runs as a dedicated unprivileged user holding only the capabilities needed to create namespaces and cgroups. Hidden tests reach it only through the internal queue channel and are never exposed by any browser-facing endpoint.
- Treat **compilation as hostile too** (template bombs, huge includes, `.incbin` tricks): its own profile, its own limits.
- Cap output size and stack explicitly to defeat output flooding.
- Hidden tests and reference answers never enter a participant sandbox and never leave the judge host except as verdicts. Participants see only the verdict, failing test number and group, usage numbers and the complexity explanation.
- Web: argon2id password hashing, secure session cookies, CSRF protection, rate limits on login and submit, strict CSP, request size limits.
- **Verification before production:** a written threat model; the escape corpus run in CI on every kernel and runner change; fuzzing of the runner's config parsing and syscall filter; an external review or a red-team contest on a staging judge before any real event.
- Patch policy: kernel and toolchain updates go to one judge host first and must pass the differential and timing-calibration suites.

## 13. Setup, Distribution and Deployment

**The goal: from `git clone` to a working judge in minutes.** One prerequisite (Docker with Compose), no manual configuration, no Go, Rust or Node installed on the user's machine.

```
git clone https://github.com/<you>/codebench && cd codebench
./codebench up
```

**What `./codebench up` does**

1. Runs `doctor`: checks the kernel, cgroup v2, user namespaces, Docker and Compose versions, free ports, core count and RAM. Every failure prints the exact command that fixes it.
2. Generates `.env` with random secrets on first run. There is nothing to edit.
3. Pulls prebuilt multi-arch images (amd64 and arm64), or builds them with `./codebench up --build`. The build runs entirely inside Docker.
4. Starts the stack. Migrations run automatically, sample problems and a demo contest are seeded, and an admin account is created with a generated password printed once.
5. Prints the URL, including the LAN address, and the host's timing grade.

**Default stack: three containers plus an optional proxy**

- `api`: the Go binary with the SPA and an embedded NATS server inside it, so there is no separate queue to install or configure.
- `postgres`: current stable, with migrations applied by the API at startup.
- `judge`: the Rust daemon on an image built from the official GCC image plus Clang. It needs elevated privileges to create namespaces and cgroups, so it gets the minimum: `cgroup: host`, the specific capabilities it needs, a read-only root and no database credentials. It talks only to the embedded queue with a generated token; problem packages and tests arrive through the queue's object store, keyed by package hash and cached on the judge.
- `caddy` (optional, `--lan-tls`): automatic internal TLS for a LAN hostname.

**Timing-quality grades.** `doctor` grades every judge host, and the admin UI shows it.

| Grade | Host | Good for |
| --- | --- | --- |
| A | Linux (bare metal or VM) after `./codebench tune`, isolated cores | Real contests and interviews |
| B | Linux with default settings | Practice and casual contests |
| C | Docker Desktop on macOS or Windows | Development and practice; times are approximate, and starting a contest shows a warning |

**Tuning for serious contests.** `sudo ./codebench tune` applies the settings from Section 4.4 (governor, SMT siblings, `isolcpus` kernel arguments with a reboot prompt, swap, hugepages). It asks before changing anything and `./codebench tune --undo` reverts it. On a single host the up command also splits the cores: the judge gets dedicated cpusets, and the API, Postgres and proxy share the rest.

**CLI** (one Go binary, wrapped by the `./codebench` script)

| Command | What it does |
| --- | --- |
| `./codebench up` | Preflight, generate config, pull or build, start, seed, print URLs |
| `./codebench doctor` | Check kernel, cgroup v2, namespaces, ports, cores; print fixes and the timing grade |
| `./codebench tune` | Apply (or with `--undo`, revert) host settings for accurate timing |
| `./codebench dev` | Hot-reload development stack (Go, Vite, cargo watch) |
| `./codebench admin create` | Create or reset an admin account |
| `./codebench problems validate` and `import` | Run the publish gate on a package folder, then import it |
| `./codebench add-judge` | Print the one-line command that joins another machine as a judge |
| `./codebench backup` and `restore` | One-file backup of the database and problem packages |
| `./codebench update` | Pull the new version, back up, migrate, restart judges one at a time |
| `./codebench down` and `uninstall` | Stop; remove containers and optionally data |

**Scaling out.** Run `./codebench add-judge` on another machine of the same CPU model; the printed command installs and registers it with the queue token. Tag hosts by hardware class and route a contest to one class, since different CPU models make time limits unfair.

**Updates and backups.** `./codebench update` takes a backup before migrating and drains each judge before restarting it. Data lives in a `./data` directory that can be copied or backed up with ordinary tools; for larger installs, enable Postgres WAL archiving.

**Reproducibility.** Release images are built in CI, versioned and signed. The toolchain image pins exact GCC and Clang versions, and `compose.yaml` pins image digests, so every install judges identically.

**Setup acceptance test (CI, every release).** On a clean VM of each supported distribution: clone, run `./codebench up`, submit the reference and wrong solutions of the sample problems, and assert the verdicts, all within a fixed time budget. A change that breaks the install fails the build.

**Hardened path.** For maximum timing accuracy or no-Docker environments, `./codebench install --systemd` installs the same binaries as systemd services on the host, including the judge, with the same config. Rolling upgrades drain a judge before restarting it; never upgrade judges during a contest.

## 14. Reliability, Observability and Testing

**Service-level objectives** (targets to confirm by load test):

| Indicator | Target |
| --- | --- |
| Submit to compile start, idle judge | under 100 ms at p95 |
| Queue wait during a contest at expected load | under 2 s at p95 |
| CPU-time drift of one program across judges of the same class | within a few percent |
| Submissions lost or duplicated | zero |

**Metrics to export.** Queue depth per lane, latency per stage (queue, compile, run, check), compile cache hit rate, sandbox errors by type (`SE` count), slot quarantines, per-host CPU frequency and temperature, SSE connection count, Postgres lock waits.

**Timing calibration.** A canary job (fixed program, fixed input) runs on every judge every few minutes. A host whose result drifts outside tolerance is drained automatically and an operator is alerted.

**Testing pyramid.**

- Unit tests for scoring, state machines and checkers.
- Golden tests: every problem package passes its own validation (reference passes, wrong solutions fail, the validator accepts every test).
- Differential tests of the native runner against `isolate`, plus the escape corpus.
- Property and fuzz tests for the problem importer and the runner configuration.
- Load tests (k6 or a Go load generator) that replay a recorded contest at several times its size while workers are killed at random, to prove nothing is lost or duplicated.
- Playwright end-to-end tests for both contest modes.

**Operations.** One-command rejudge (a submission, a problem version, a whole contest) through `rejudge_batches`; an audit log on every admin action; feature flags for contest rules; a runbook for each alert.

## 15. Production Roadmap

Milestones run in dependency order. The sandbox comes before the web app because everything else rests on its correctness and timing; M2 and M3 can run in parallel with two engineers.

| Milestone | Scope | Exit gate |
| --- | --- | --- |
| M0 Foundations | Repo, CI, shared message schemas, Postgres schema and migrations, compose.yaml, the codebench CLI (up, doctor), published images, observability skeleton | A fresh clone on a clean VM reaches a working judge with one command (the setup acceptance test), and a hello-world job travels API, NATS, judge, Postgres, browser with metrics on every hop |
| M1 Sandbox and judge core | Rust runner (namespaces, cgroups, seccomp, Landlock, perf counters), compile pipeline with PCH and cache, checkers with testlib, `isolate` adapter | Escape corpus and differential tests green; timing drift within tolerance over repeated runs |
| M2 Problem system | Package format, validator, generators, wrong-solution gate, immutable versions, import and validate CLI | Ten reference problems published only after passing the gate |
| M3 Web and submissions | Auth, problem list and page, editor, Run and Submit, outbox to NATS, SSE verdicts | Crash tests (kill the API, kill a judge mid-run) lose and duplicate nothing |
| M4 Contest engine | Fixed contests, server timer, scoring strategies, in-memory standings, freeze, admin console | A simulated 100-user contest matches a reference scoring script exactly |
| M5 Practice mode | Tag and difficulty draw, history, private sets, ratings | Mode B runs on the same contest engine with no forked code paths |
| M6 Complexity enforcement | Call-counting harness, interactive judge, query budgets, scaling analysis, complexity reports shown to users | Every problem with a complexity policy has wrong solutions that fail it |
| M7 Hardening and launch | External security review, load and chaos tests, plagiarism checks, backup restore drill, runbooks, SLO dashboards | SLOs hold at 3x expected contest size; restore drill passes; a staging contest completes cleanly |

## 16. Decision Summary

- **Languages:** Go for the API, Rust for the judge, TypeScript (SolidJS) for the frontend.
- **Data and messaging:** PostgreSQL as source of truth, NATS JetStream for jobs and events, in-memory standings in the API, no Redis.
- **Sandbox:** native Rust runner (cgroups v2, namespaces, seccomp, Landlock) with `isolate` as the reference oracle.
- **Speed:** PCH, fast linker, content-addressed compile cache, separate compile and run pools, pinned isolated cores, tmpfs and memfd, prebuilt slots, fail fast.
- **Complexity enforcement:** many-query tests, call-counting harness or interactive query budget, instruction-count scaling as supporting evidence, and a publish gate requiring all wrong solutions to fail.
- **Contest engine:** one Contest model with Strategy-based scoring for both modes, immutable problem versions, transactional outbox.
- **Production:** SLOs, canary timing jobs, differential and chaos testing, external security review before real events.
- **Setup:** `git clone` then `./codebench up`; Docker Compose by default with prebuilt signed images, embedded NATS, auto-generated config, seeded sample problems, a timing-quality grade from `doctor`, and `./codebench tune` for contest-grade hosts.

Next, any piece can be specified down to code level: the runner's syscall allowlist and escape corpus, the judge pipeline and NATS message schemas, the full Postgres DDL, or the call-counting harness.
