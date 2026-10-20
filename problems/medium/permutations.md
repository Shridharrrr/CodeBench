---
slug: permutations
title: "Permutations"
difficulty: Medium
tags:
  - array
  - backtracking
time_limit_ms: 1000
memory_mb: 256
contest_label: K
points: 200
checker_type: token
---

# Permutations

Given an array `nums` of distinct integers, return all the possible permutations. Output each permutation on a new line in lexicographical order.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated distinct integers.

### Output Format
Print each permutation on a new line.

### Constraints
- 1 <= n <= 6
- -10 <= nums[i] <= 10
- All the integers of nums are unique.

### Sample Test 1
```input
3
1 2 3
```
```output
1 2 3
1 3 2
2 1 3
2 3 1
3 1 2
3 2 1
```

### Sample Test 2
```input
2
0 1
```
```output
0 1
1 0
```

### Hidden Test 1
```input
1
1
```
```output
1
```

### Hidden Test 2
```input
3
1 1 2
```
```output
1 1 2
1 2 1
2 1 1
```
