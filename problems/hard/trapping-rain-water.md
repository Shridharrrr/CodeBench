---
slug: trapping-rain-water
title: "Trapping Rain Water"
difficulty: Hard
tags:
  - array
  - two-pointers
  - dynamic-programming
  - stack
time_limit_ms: 1000
memory_mb: 256
contest_label: D
points: 300
checker_type: token
---

# Trapping Rain Water

Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers representing the height elevation map.

### Output Format
Print the total units of water trapped.

### Constraints
- 1 <= n <= 2 * 10^4
- 0 <= height[i] <= 10^5

### Sample Test 1
```input
12
0 1 0 2 1 0 1 3 2 1 2 1
```
```output
6
```

### Sample Test 2
```input
6
4 2 0 3 2 5
```
```output
9
```

### Hidden Test 1
```input
1
0
```
```output
0
```

### Hidden Test 2
```input
5
3 0 0 0 3
```
```output
9
```
