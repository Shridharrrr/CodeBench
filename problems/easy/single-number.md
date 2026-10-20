---
slug: single-number
title: "Single Number"
difficulty: Easy
tags:
  - array
  - bit-manipulation
time_limit_ms: 1000
memory_mb: 256
contest_label: T
points: 100
checker_type: token
---

# Single Number

Given a non-empty array of integers `nums`, every element appears twice except for one. Find that single one.

You must implement a solution with a linear runtime complexity and use only constant extra space.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers.

### Output Format
Print the single unique integer.

### Constraints
- 1 <= n <= 3 * 10^4
- -3 * 10^4 <= nums[i] <= 3 * 10^4
- Each element in the array appears twice except for one element which appears once.

### Sample Test 1
```input
3
2 2 1
```
```output
1
```

### Sample Test 2
```input
5
4 1 2 1 2
```
```output
4
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
7
5 3 4 3 4 5 99
```
```output
99
```
