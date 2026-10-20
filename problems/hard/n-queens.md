---
slug: n-queens
title: "N-Queens"
difficulty: Hard
tags:
  - array
  - backtracking
time_limit_ms: 1000
memory_mb: 256
contest_label: E
points: 300
checker_type: token
---

# N-Queens

The n-queens puzzle is the problem of placing `n` queens on an `n x n` chessboard such that no two queens attack each other.

Given an integer `n`, return the total number of distinct solutions to the n-queens puzzle.

### Input Format
A single line containing the integer `n`.

### Output Format
Print the number of distinct solutions as an integer.

### Constraints
- 1 <= n <= 12

### Sample Test 1
```input
4
```
```output
2
```

### Sample Test 2
```input
1
```
```output
1
```

### Hidden Test 1
```input
8
```
```output
92
```

### Hidden Test 2
```input
9
```
```output
352
```
