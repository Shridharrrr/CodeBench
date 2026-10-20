---
slug: maximum-subarray
title: "Maximum Subarray"
difficulty: Medium
tags:
  - array
  - divide-and-conquer
  - dynamic-programming
time_limit_ms: 1000
memory_mb: 256
contest_label: N
points: 200
checker_type: token
---

# Maximum Subarray

Given an integer array `nums`, find the subarray with the largest sum, and return its sum.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers.

### Output Format
Print the maximum subarray sum.

### Constraints
- 1 <= n <= 10^5
- -10^4 <= nums[i] <= 10^4

### Sample Test 1
```input
9
-2 1 -3 4 -1 2 1 -5 4
```
```output
6
```

### Sample Test 2
```input
1
1
```
```output
1
```

### Hidden Test 1
```input
5
5 4 -1 7 8
```
```output
23
```

### Hidden Test 2
```input
3
-3 -2 -1
```
```output
-1
```
