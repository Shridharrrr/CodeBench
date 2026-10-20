---
slug: spiral-matrix
title: "Spiral Matrix"
difficulty: Medium
tags:
  - array
  - matrix
  - simulation
time_limit_ms: 1000
memory_mb: 256
contest_label: O
points: 200
checker_type: token
---

# Spiral Matrix

Given an `m x n` matrix, return all elements of the matrix in spiral order.

### Input Format
The first line contains `m` and `n`.
The next `m` lines contain `n` space-separated integers each.

### Output Format
Print the elements in spiral order separated by spaces.

### Constraints
- 1 <= m, n <= 10
- -100 <= matrix[i][j] <= 100

### Sample Test 1
```input
3 3
1 2 3
4 5 6
7 8 9
```
```output
1 2 3 6 9 8 7 4 5
```

### Sample Test 2
```input
3 4
1 2 3 4
5 6 7 8
9 10 11 12
```
```output
1 2 3 4 8 12 11 10 9 5 6 7
```

### Hidden Test 1
```input
1 1
42
```
```output
42
```

### Hidden Test 2
```input
2 2
1 2
3 4
```
```output
1 2 4 3
```
