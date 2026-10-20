---
slug: binary-tree-level-order-traversal
title: "Binary Tree Level Order Traversal"
difficulty: Medium
tags:
  - tree
  - breadth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: W
points: 200
checker_type: token
---

# Binary Tree Level Order Traversal

Given the root of a binary tree, return the level order traversal of its nodes' values (i.e., from left to right, level by level). Print each level on a new line.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated tokens (`null` for empty node).

### Output Format
Print each level on a new line with space-separated node values.

### Constraints
- 0 <= n <= 2000
- -1000 <= Node.val <= 1000

### Sample Test 1
```input
5
3 9 20 null null 15 7
```
```output
3
9 20
15 7
```

### Sample Test 2
```input
1
1
```
```output
1
```

### Hidden Test 1
```input
0

```
```output

```

### Hidden Test 2
```input
3
1 2 3
```
```output
1
2 3
```
