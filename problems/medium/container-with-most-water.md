---
slug: container-with-most-water
title: "Container With Most Water"
difficulty: Medium
tags:
  - array
  - two-pointers
  - greedy
time_limit_ms: 1000
memory_mb: 256
contest_label: D
points: 200
checker_type: token
---

# Container With Most Water

You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i`-th line are `(i, 0)` and `(i, height[i])`.

Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers representing heights.

### Output Format
Print the maximum area of water.

### Constraints
- 2 <= n <= 10^5
- 0 <= height[i] <= 10^4

### Sample Test 1
```input
9
1 8 6 2 5 4 8 3 7
```
```output
49
```

### Sample Test 2
```input
2
1 1
```
```output
1
```

### Hidden Test 1
```input
4
4 3 2 1 4
```
```output
16
```

### Hidden Test 2
```input
5
1 2 1 2 1
```
```output
4
```
