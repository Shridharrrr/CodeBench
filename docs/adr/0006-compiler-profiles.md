# ADR 0006: Compiler Profiles, Toolchains, and LeetCode Driver Harness

## Status
Accepted

## Context
CodeBench supports multiple languages (C++23, C23, Python 3.12, Go 1.24, Rust 1.85). Compiler optimization flags, toolchain versions, and standard library behavior across judges must remain consistent. In addition, contestants write function solutions (LeetCode style) without `int main()`, requiring an automated test driver to feed test inputs and read outputs.

## Decision
1. Define explicit compiler profiles for each language (`cpp23-gcc`, `cpp23-clang`, `c23-gcc`, `c23-clang`, `python3`, `go`, `rust`).
2. Standard C++ flags:
   `g++ -std=c++23 -O2 -pipe -static -s -DONLINE_JUDGE -o sol sol.cpp`
3. Mount toolchains and system libraries as read-only in the execution sandbox.
4. Automatically wrap function submissions with test harness drivers (`runner.WrapWithDriver`) before compilation.
5. Apply identical compiler flags and drivers to reference solutions and participant submissions.

## Consequences
- Predictable performance across judge hosts.
- Contestants focus on problem logic without writing input/output boilerplate.
