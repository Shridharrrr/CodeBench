# ADR 0008: Docker Desktop Compatibility and Timing Grades

## Status
Accepted

## Context
Developers and evaluators will clone Codebench on macOS and Windows using Docker Desktop. Docker Desktop runs a Linux VM (WSL2 on Windows, HyperKit/Virtualization Framework on macOS) with non-deterministic hypervisor virtualization overhead and timing jitter.

## Decision
1. Implement host capability and timing grading in `codebench doctor` and host telemetry:
   - **Grade A**: Bare-metal Linux host with tuned CPU governors, swap disabled, and isolated cores (`isolcpus`). Suited for live competitions and interviews.
   - **Grade B**: Linux host with default OS scheduling. Suitable for casual practice.
   - **Grade C**: Docker Desktop on Windows/macOS. Suitable for development, functional testing, and practice.
2. The UI and API display clear warnings when running in Grade C environments during competitive events.

## Consequences
- Frictionless local onboarding for developers on any OS.
- Transparent guarantees regarding timing precision for real competitions.
