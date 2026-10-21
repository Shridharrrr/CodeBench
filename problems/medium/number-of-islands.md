---
slug: number-of-islands
title: "Number of Islands"
difficulty: Medium
tags:
  - array
  - depth-first-search
  - breadth-first-search
  - union-find
time_limit_ms: 1000
memory_mb: 256
contest_label: AC
points: 200
checker_type: token
---

# Number of Islands

Given an `m x n` 2D binary grid `grid` which represents a map of `'1'`s (land) and `'0'`s (water), return the number of islands.

An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.


### Constraints
- 1 <= m, n <= 300
- grid[i][j] is '0' or '1'.

### Sample Test 1
```input
4 5
1 1 1 1 0
1 1 0 1 0
1 1 0 0 0
0 0 0 0 0
```
```output
1
```

### Sample Test 2
```input
4 5
1 1 0 0 0
1 1 0 0 0
0 0 1 0 0
0 0 0 1 1
```
```output
3
```

### Hidden Test 1
```input
1 1
1
```
```output
1
```

### Hidden Test 2
```input
3 3
1 0 1
0 1 0
1 0 1
```
```output
5
```
