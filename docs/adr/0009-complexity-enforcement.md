# ADR 0009: Complexity Enforcement Strategy

## Status
Accepted

## Context
A critical requirement is enforcing intended algorithmic complexity (e.g., ensuring an $O(N)$ linear search cannot pass an $O(\log N)$ binary search problem, even if total wall clock time is small).

## Decision
1. In-process call counters are not treated as cryptographic security boundaries for untrusted native code.
2. Layered complexity enforcement is implemented:
   - **Layer 1: Input Scaling / Many Queries**: Massively repeating queries on preprocessed data ($Q = 10^6, N = 10^6$) where $O(Q \log N)$ passes within 100ms and $O(Q \cdot N)$ takes minutes and triggers deterministic TLE.
   - **Layer 2: Separate-process query budget interactors**: Interactive query protocol running in an isolated sandbox, enforcing strict query budgets outside participant memory space.
   - **Layer 3: Retired instruction counters**: Hardware performance counters (`perf_event_open`) measuring retired user-mode instructions to detect algorithmic scaling curves across sample sizes.
   - **Publish Gate**: A problem cannot be published until all deliberately wrong solutions (O(N^2), naive linear scan) demonstrably fail and reference solutions pass.

## Consequences
- Guaranteed detection of suboptimal algorithmic approaches.
- Clear, understandable failure feedback (`COMPLEXITY_FAIL: used 100000 queries, limit 25`).
