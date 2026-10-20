---
slug: binary-tree-maximum-path-sum
title: "Binary Tree Maximum Path Sum"
difficulty: Hard
tags:
  - dynamic-programming
  - tree
  - depth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: I
points: 300
checker_type: token
---

# Binary Tree Maximum Path Sum

A path in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence at most once. Note that the path does not need to pass through the root.

The path sum of a path is the sum of the node's values in the path.

Given the root of a binary tree, return the maximum path sum of any non-empty path.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated tokens representing level-order traversal (`null` for empty child).

### Output Format
Print the maximum path sum as an integer.

### Constraints
- 1 <= n <= 3 * 10^4
- -1000 <= Node.val <= 1000

### Sample Test 1
```input
3
1 2 3
```
```output
6
```

### Sample Test 2
```input
5
-10 9 20 null null 15 7
```
```output
42
```

### Hidden Test 1
```input
1
-3
```
```output
-3
```

### Hidden Test 2
```input
3
2 -1 -2
```
```output
2
```
