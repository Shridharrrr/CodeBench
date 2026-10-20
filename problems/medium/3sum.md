---
slug: 3sum
title: "3Sum"
difficulty: Medium
tags:
  - array
  - two-pointers
  - sorting
time_limit_ms: 1000
memory_mb: 256
contest_label: A
points: 200
checker_type: token
---

# 3Sum

Given an integer array nums, return all the triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.

Notice that the solution set must not contain duplicate triplets. Print each triplet on a new line sorted in ascending order.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers.

### Output Format
Print each unique triplet on a new line with space-separated values. Triplets should be printed in lexicographical order.

### Constraints
- 3 <= n <= 3000
- -10^5 <= nums[i] <= 10^5

### Sample Test 1
```input
6
-1 0 1 2 -1 -4
```
```output
-1 -1 2
-1 0 1
```

### Sample Test 2
```input
3
0 1 1
```
```output

```

### Hidden Test 1
```input
3
0 0 0
```
```output
0 0 0
```

### Hidden Test 2
```input
7
-2 0 1 1 2 -1 -4
```
```output
-2 0 2
-2 1 1
-1 0 1
```
