---
slug: maximum-depth-of-binary-tree
title: "Maximum Depth of Binary Tree"
difficulty: Easy
tags:
  - tree
  - depth-first-search
  - breadth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: S
points: 100
checker_type: token
---

# Maximum Depth of Binary Tree

Given the root of a binary tree, return its maximum depth.

A binary tree's maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.

### Input Format
The first line contains `n`, the number of elements in level-order representation.
The second line contains `n` space-separated tokens (`null` for absent nodes).

### Output Format
Print the maximum depth as an integer.

### Constraints
- 0 <= n <= 10^4
- -100 <= Node.val <= 100

### Sample Test 1
```input
5
3 9 20 null null 15 7
```
```output
3
```

### Sample Test 2
```input
2
1 null 2
```
```output
2
```

### Hidden Test 1
```input
0

```
```output
0
```

### Hidden Test 2
```input
1
0
```
```output
1
```
