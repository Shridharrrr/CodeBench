---
slug: subsets
title: "Subsets"
difficulty: Medium
tags:
  - array
  - backtracking
  - bit-manipulation
time_limit_ms: 1000
memory_mb: 256
contest_label: S
points: 200
checker_type: token
---

# Subsets

Given an integer array `nums` of unique elements, return all possible subsets (the power set).

The solution set must not contain duplicate subsets. Print each subset on a new line with elements sorted ascending. Sort the output subsets lexicographically.


### Constraints
- 1 <= n <= 10
- -10 <= nums[i] <= 10
- All the numbers of nums are unique.

### Sample Test 1
```input
3
1 2 3
```
```output

1
1 2
1 2 3
1 3
2
2 3
3
```

### Sample Test 2
```input
1
0
```
```output

0
```

### Hidden Test 1
```input
2
1 2
```
```output

1
1 2
2
```

### Hidden Test 2
```input
2
4 9
```
```output

4
4 9
9
```
