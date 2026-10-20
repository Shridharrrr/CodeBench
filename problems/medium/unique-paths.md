---
slug: unique-paths
title: "Unique Paths"
difficulty: Medium
tags:
  - math
  - dynamic-programming
  - combinatorics
time_limit_ms: 1000
memory_mb: 256
contest_label: R
points: 200
checker_type: token
---

# Unique Paths

There is a robot on an `m x n` grid. The robot is initially located at the top-left corner (`grid[0][0]`). The robot tries to move to the bottom-right corner (`grid[m - 1][n - 1]`). The robot can only move either down or right at any point in time.

Given the two integers `m` and `n`, return the number of possible unique paths that the robot can take to reach the bottom-right corner.

### Input Format
A single line containing two integers `m` and `n`.

### Output Format
Print the number of unique paths.

### Constraints
- 1 <= m, n <= 100

### Sample Test 1
```input
3 7
```
```output
28
```

### Sample Test 2
```input
3 2
```
```output
3
```

### Hidden Test 1
```input
1 1
```
```output
1
```

### Hidden Test 2
```input
7 3
```
```output
28
```
