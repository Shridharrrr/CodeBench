# ADR 0001: Sandbox Trust Boundary and Kernel Requirements

## Status
Accepted

## Context
Codebench must judge arbitrary native C and C++ submissions without risking host integrity, lateral movement, or denial of service. Traditional unsandboxed `fork/exec` or script wrappers are unacceptable.

## Decision
1. All participant execution and compilation must take place within a specialized Linux sandbox runner written in Rust.
2. The sandbox requires:
   - Linux cgroups v2 (`memory`, `cpu`, `pids`, `cpuset`).
   - Namespaces: Mount, PID, Network, IPC, UTS, User, and Cgroup.
   - `clone3` with `CLONE_INTO_CGROUP`.
   - Seccomp-BPF strict syscall allowlist with default kill action.
   - Landlock LSM for filesystem access containment.
   - `perf_event_open` for retired instruction measurement.
3. If any mandatory kernel capability is unavailable, the judge must immediately fail-closed and mark the host as unavailable rather than falling back to unisolated execution.

## Consequences
- Requires Linux host or Linux VM (via Docker Desktop on macOS/Windows for development).
- Guarantees defense-in-depth isolation against hostile submissions.
