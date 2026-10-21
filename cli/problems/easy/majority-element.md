---
slug: majority-element
title: "Majority Element"
difficulty: Easy
tags:
  - array
  - hash-table
  - divide-and-conquer
  - counting
time_limit_ms: 1000
memory_mb: 256
contest_label: Q
points: 100
checker_type: token
---

# Majority Element

Given an array `nums` of size `n`, return the majority element.

The majority element is the element that appears more than $\lfloor n / 2 \rfloor$ times. You may assume that the majority element always exists in the array.


### Constraints
- 1 <= n <= 5 * 10^4
- -10^9 <= nums[i] <= 10^9

### Sample Test 1
```input
3
3 2 3
```
```output
3
```

### Sample Test 2
```input
7
2 2 1 1 1 2 2
```
```output
2
```

### Hidden Test 1
```input
1
100
```
```output
100
```

### Hidden Test 2
```input
5
6 5 5 5 6
```
```output
5
```
