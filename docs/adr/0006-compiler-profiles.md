# ADR 0006: C/C++ Compiler Profiles and Toolchain Pinning

## Status
Accepted

## Context
Codebench targets the latest standards (C++23 and C23) using modern GCC and Clang compilers. Variations in compiler optimization flags or standard library behavior across judges cause non-reproducible outcomes.

## Decision
1. Pin compiler profiles in explicit code definitions (`cpp23-gcc`, `cpp23-clang`, `c23-gcc`, `c23-clang`).
2. Standard C++23 flags:
   `g++ -std=c++23 -O2 -pipe -static -s -DONLINE_JUDGE -o sol sol.cpp`
3. Toolchain files and base libraries are mounted read-only into compiler sandboxes.
4. Compiler flags are identical for reference solutions, deliberate wrong solutions, and participant code.

## Consequences
- Deterministic binaries and identical performance profiles across judge hosts.
- Hardened static binaries simplify minimal tmpfs execution root.
