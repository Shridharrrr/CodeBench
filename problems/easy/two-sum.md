---
slug: two-sum
title: "Two Sum"
difficulty: Easy
tags:
  - array
  - hash-table
time_limit_ms: 1000
memory_mb: 256
contest_label: A
points: 100
checker_type: token
---

# Two Sum

Given an array of integers `nums` and an integer `target`, return the 0-based indices of the two numbers such that they add up to `target`.

You may assume that each input would have exactly one solution, and you may not use the same element twice. Output the smaller index first, followed by the larger index.


### Constraints
- 2 <= n <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Exactly one valid answer exists.

### Sample Test 1
```input
4 9
2 7 11 15
```
```output
0 1
```

### Sample Test 2
```input
3 6
3 2 4
```
```output
1 2
```

### Hidden Test 1
```input
2 6
3 3
```
```output
0 1
```

### Hidden Test 2
```input
5 100
10 20 30 70 90
```
```output
2 3
```
