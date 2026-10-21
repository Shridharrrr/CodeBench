---
slug: flood-fill
title: "Flood Fill"
difficulty: Easy
tags:
  - array
  - depth-first-search
  - breadth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: I
points: 100
checker_type: token
---

# Flood Fill

An image is represented by an `m x n` integer grid `image` where `image[i][j]` represents the pixel value of the image.

You are also given three integers `sr`, `sc`, and `color`. You should perform a flood fill on the image starting from the pixel `image[sr][sc]`.

To perform a flood fill, consider the starting pixel, plus any pixels connected 4-directionally to the starting pixel of the same color as the starting pixel, plus any pixels connected 4-directionally to those pixels (also with the same color), and so on. Replace the color of all of the aforementioned pixels with `color`.


### Constraints
- 1 <= m, n <= 50
- 0 <= image[i][j], color < 65536
- 0 <= sr < m
- 0 <= sc < n

### Sample Test 1
```input
3 3
1 1 1
1 1 0
1 0 1
1 1 2
```
```output
2 2 2
2 2 0
2 0 1
```

### Sample Test 2
```input
2 3
0 0 0
0 0 0
0 0 0
```
```output
0 0 0
0 0 0
```

### Hidden Test 1
```input
1 1
5
0 0 2
```
```output
2
```

### Hidden Test 2
```input
3 3
0 0 0
0 1 1
0 1 1
1 1 1
```
```output
0 0 0
0 1 1
0 1 1
```
