---
slug: combination-sum
title: "Combination Sum"
difficulty: Medium
tags:
  - array
  - backtracking
time_limit_ms: 1000
memory_mb: 256
contest_label: J
points: 200
checker_type: token
---

# Combination Sum

Given an array of distinct integers `candidates` and a target integer `target`, return a list of all unique combinations of `candidates` where the chosen numbers sum to `target`. You may return the combinations in any order.

The same number may be chosen from `candidates` an unlimited number of times. Two combinations are unique if the frequency of at least one of the chosen numbers is different.

### Input Format
The first line contains `n` and `target`.
The second line contains `n` distinct space-separated integers.

### Output Format
Print each combination on a new line with space-separated values sorted ascending.

### Constraints
- 1 <= n <= 30
- 2 <= candidates[i] <= 40
- All elements of candidates are distinct.
- 1 <= target <= 40

### Sample Test 1
```input
4 7
2 3 6 7
```
```output
2 2 3
7
```

### Sample Test 2
```input
3 8
2 3 5
```
```output
2 2 2 2
2 3 3
3 5
```

### Hidden Test 1
```input
1 2
2
```
```output
2
```

### Hidden Test 2
```input
2 1
2 3
```
```output

```
