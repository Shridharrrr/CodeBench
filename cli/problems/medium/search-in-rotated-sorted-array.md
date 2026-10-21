---
slug: search-in-rotated-sorted-array
title: "Search in Rotated Sorted Array"
difficulty: Medium
tags:
  - array
  - binary-search
time_limit_ms: 1000
memory_mb: 256
contest_label: I
points: 200
checker_type: token
---

# Search in Rotated Sorted Array

There is an integer array `nums` sorted in ascending order (with distinct values). Prior to being passed to your function, `nums` is possibly rotated at an unknown pivot index `k`.

Given the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`.

You must write an algorithm with $O(\log n)$ runtime complexity.


### Constraints
- 1 <= n <= 5000
- -10^4 <= nums[i], target <= 10^4
- All values of nums are unique.

### Sample Test 1
```input
7 0
4 5 6 7 0 1 2
```
```output
4
```

### Sample Test 2
```input
7 3
4 5 6 7 0 1 2
```
```output
-1
```

### Hidden Test 1
```input
1 0
1
```
```output
-1
```

### Hidden Test 2
```input
2 3
3 1
```
```output
0
```
