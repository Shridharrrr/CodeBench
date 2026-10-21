---
slug: rotate-image
title: "Rotate Image"
difficulty: Medium
tags:
  - array
  - math
  - matrix
time_limit_ms: 1000
memory_mb: 256
contest_label: L
points: 200
checker_type: token
---

# Rotate Image

You are given an `n x n` 2D matrix representing an image, rotate the image by 90 degrees (clockwise) in-place.


### Constraints
- 1 <= n <= 20
- -1000 <= matrix[i][j] <= 1000

### Sample Test 1
```input
3
1 2 3
4 5 6
7 8 9
```
```output
7 4 1
8 5 2
9 6 3
```

### Sample Test 2
```input
4
5 1 9 11
2 4 8 10
13 3 6 7
15 14 12 16
```
```output
15 13 2 5
14 3 4 1
12 6 8 9
16 7 10 11
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
2
1 2
3 4
```
```output
3 1
4 2
```
