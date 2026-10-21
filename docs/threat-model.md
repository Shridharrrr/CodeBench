# CodeBench Security & Threat Model

This document outlines how CodeBench isolates untrusted code submissions and protects host infrastructure.

---

## 1. Overview & Trust Boundaries

CodeBench accepts and executes untrusted code submitted by participants (in C++, Python, Go, and Rust). The system must run this code safely without compromising the host machine or leaking hidden test cases.

```
+-------------------------------------------------------------+
| Participant Browser / CLI (Untrusted)                       |
+-------------------------------------------------------------+
                            │ HTTP / WebSockets / SSE
+-------------------------------------------------------------+
| API Server (Go)                                             |
| - Authenticates requests and applies rate limits            |
| - Wraps function submissions with test harness drivers      |
| - Persists state in PostgreSQL                              |
+-------------------------------------------------------------+
                            │ Work Queue (NATS JetStream)
+-------------------------------------------------------------+
| Judge Runner (Rust Sandbox)                                 |
| - Compiles code under CPU & memory limits                   |
| - Executes binaries in isolated Linux sandboxes             |
+-------------------------------------------------------------+
                            │ Linux Namespaces & cgroups v2
+-------------------------------------------------------------+
| Sandbox Process (Untrusted Binary)                          |
| - No network access                                         |
| - Read-only filesystem                                      |
| - Enforced memory ceiling & CPU time limit                  |
+-------------------------------------------------------------+
```

---

## 2. Threat Scenarios & Defenses

### Malicious Code Execution (Host Escape)
- **Risk**: A submitted solution tries to access the host filesystem, spawn background daemons, or run unauthorized binaries.
- **Defense**: Submissions run inside dedicated Linux namespaces (Mount, PID, Network) with a read-only root filesystem. System calls like `fork`, `execve`, and socket calls are restricted via Seccomp filters.

### Resource Exhaustion (Denial of Service)
- **Risk**: A submission enters an infinite loop, attempts a fork bomb, or allocates gigabytes of memory to crash the host.
- **Defense**:
  - Memory is capped with cgroups v2 (`memory.max`). Exceeding the limit results in an immediate Memory Limit Exceeded (MLE) verdict.
  - CPU runtime is bounded by a timer; processes exceeding the problem limit are terminated with Time Limit Exceeded (TLE).
  - Maximum process count is constrained (`pids.max`) to stop fork bombs.

### Test Case Tampering & Leakage
- **Risk**: A contestant attempts to inspect hidden test cases by reading disk directories or dumping environment variables.
- **Defense**: Hidden tests are never written to the contestant's sandbox disk. They are fed directly through standard input pipes and discarded from memory after evaluation.

### Network Attacks
- **Risk**: A submission attempts to scan local networks, access internal services (e.g. database ports), or make outbound internet calls.
- **Defense**: The network namespace has no external network interfaces (`loopback down`). All network communication from the sandbox is blocked at the kernel level.

---

## 3. Practical Environment Notes

- **Linux Bare-Metal**: Full cgroups v2, Seccomp, and instruction-counter support are available for maximum precision.
- **Windows / macOS (Docker Desktop)**: Runs inside a Linux VM. System calls and memory limits are still enforced by the Linux kernel inside the VM, with minor timing variance due to hypervisor scheduling.
