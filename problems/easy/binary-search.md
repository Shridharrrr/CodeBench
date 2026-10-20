---
slug: binary-search
title: "Binary Search"
difficulty: Easy
tags:
  - array
  - binary-search
time_limit_ms: 1000
memory_mb: 256
contest_label: H
points: 100
checker_type: token
---

# Binary Search

Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return -1.

You must write an algorithm with $O(\log n)$ runtime complexity.

### Input Format
The first line contains two integers `n` and `target`.
The second line contains `n` space-separated sorted integers.

### Output Format
Print the index of `target`, or -1 if not found.

### Constraints
- 1 <= n <= 10^4
- -10^4 < nums[i], target < 10^4
- All elements in nums are unique and sorted in ascending order.

### Sample Test 1
```input
6 9
-1 0 3 5 9 12
```
```output
4
```

### Sample Test 2
```input
6 2
-1 0 3 5 9 12
```
```output
-1
```

### Hidden Test 1
```input
1 5
5
```
```output
0
```

### Hidden Test 2
```input
2 1
2 5
```
```output
-1
```
