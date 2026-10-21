---
slug: merge-intervals
title: "Merge Intervals"
difficulty: Medium
tags:
  - array
  - sorting
time_limit_ms: 1000
memory_mb: 256
contest_label: Q
points: 200
checker_type: token
---

# Merge Intervals

Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.


### Constraints
- 1 <= n <= 10^4
- 0 <= start_i <= end_i <= 10^4

### Sample Test 1
```input
4
1 3
2 6
8 10
15 18
```
```output
1 6
8 10
15 18
```

### Sample Test 2
```input
2
1 4
4 5
```
```output
1 5
```

### Hidden Test 1
```input
1
1 4
```
```output
1 4
```

### Hidden Test 2
```input
3
1 4
0 2
3 5
```
```output
0 5
```
