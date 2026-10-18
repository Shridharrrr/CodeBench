# Codebench Threat Model

## 1. System Overview & Assets
Codebench is a local and contest-grade judge platform designed to execute untrusted, potentially adversarial C/C++ submissions.

### Critical Assets
1. **Host Integrity**: The judge host OS, kernel, root filesystem, system daemons, and host resources.
2. **Confidential Test Cases**: Hidden inputs, jury outputs, and reference solutions.
3. **Evaluation Integrity**: Accurate CPU/memory accounting, tamper-proof verdicts, deterministic outcomes.
4. **Platform Availability**: Web API, database, and message broker service availability during contests.
5. **Participant Data**: User credentials, sessions, and non-public submission source code.

## 2. Threat Actors & Attack Vectors
- **Adversarial Participant**: Submits malicious C/C++ code designed to escape sandboxes, exhaust resources, read hidden tests, tamper with other sandboxes, or forge verdicts.
- **Malicious Problem Author**: Imports malformed problem packages with path traversal, malicious testlib generators, or bloated test files.
- **Network Attacker (LAN)**: Attempts denial of service, session hijacking, or eavesdropping on unencrypted internal communications.

## 3. Trust Boundaries
```
+-------------------------------------------------------------+
| Browser (Untrusted)                                         |
+-------------------------------------------------------------+
                            | HTTPS / Session Cookie
+-------------------------------------------------------------+
| Edge / Reverse Proxy (Caddy) & API (Go Modular Monolith)    |
| - Authenticates users, validates requests                   |
| - Manages PostgreSQL & Transactional Outbox                 |
+-------------------------------------------------------------+
                            | NATS JetStream (Work Queues)
+-------------------------------------------------------------+
| Judge Host Daemon (Rust)                                    |
| - Receives authenticated jobs by cryptographic hash         |
| - Spawns sandboxed processes via native Linux primitives   |
+-------------------------------------------------------------+
                            | clone3 / namespaces / cgroups / seccomp / landlock
+-------------------------------------------------------------+
| Sandbox Environment (Untrusted execution)                   |
| - Read-only root tmpfs, zero network, isolated PID/IPC/MNT  |
| - Pinned isolated CPU core, strict cgroup v2 limits         |
+-------------------------------------------------------------+
```

## 4. Mitigations
- **Kernel-level Sandboxing**: cgroups v2 (`memory.max`, `memory.swap.max=0`, `pids.max=1`), Landlock filesystem rules, Seccomp-BPF strict allowlist, `no_new_privs`, dropped capabilities (`CAP_*`).
- **Compilation Sandboxing**: Dedicated compilation sandbox with 10s CPU limit, 512MB RAM limit, read-only system headers, preventing `#include "/etc/shadow"` or fork bombs during compilation.
- **Hidden Test Isolation**: Hidden tests never enter the participant sandbox filesystem; they are streamed directly via `memfd` or pipe to `stdin`. Output is captured via capped buffers.
- **Timing & CPU Protection**: Dedicated isolated cores (`isolcpus`), reading CPU accounting directly from `cpu.stat` (cgroup v2), measuring user+sys CPU time, and instruction counts via `perf_event_open`.
- **Database & Queue Resilience**: Transactional outbox prevents lost jobs; idempotent consumer deduplicates duplicate verdicts; Argon2id protects passwords; CSRF tokens and HttpOnly SameSite cookies protect sessions.

## 5. Residual Risks & Accepted Constraints
- Docker Desktop on Windows/macOS runs inside a lightweight Linux VM with virtualized hypervisor timers; timing grade is classified as Grade C (Development/Practice only, not contest-grade).
- Non-deterministic microarchitectural side-channels are minimized through core pinning and cache isolation, but absolute microarchitectural zero-noise requires tuned bare-metal (Grade A).
