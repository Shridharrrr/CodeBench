---
slug: contains-duplicate
title: "Contains Duplicate"
difficulty: Easy
tags:
  - array
  - hash-table
  - sorting
time_limit_ms: 1000
memory_mb: 256
contest_label: R
points: 100
checker_type: token
---

# Contains Duplicate

Given an integer array `nums`, return `true` if any value appears at least twice in the array, and return `false` if every element is distinct.


### Constraints
- 1 <= n <= 10^5
- -10^9 <= nums[i] <= 10^9

### Sample Test 1
```input
4
1 2 3 1
```
```output
true
```

### Sample Test 2
```input
4
1 2 3 4
```
```output
false
```

### Hidden Test 1
```input
1
99
```
```output
false
```

### Hidden Test 2
```input
10
1 1 1 3 3 4 3 2 4 2
```
```output
true
```
