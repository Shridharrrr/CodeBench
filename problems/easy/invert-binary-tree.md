---
slug: invert-binary-tree
title: "Invert Binary Tree"
difficulty: Easy
tags:
  - tree
  - depth-first-search
  - breadth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: F
points: 100
checker_type: token
---

# Invert Binary Tree

Given the root of a binary tree, invert the tree (swap the left and right children of every node), and return its level-order traversal representation.

### Input Format
The first line contains an integer `n` representing the number of nodes in level-order traversal.
The second line contains `n` space-separated tokens where integers represent node values and `null` represents absent children.

### Output Format
Print the level-order traversal of the inverted tree as space-separated tokens.

### Constraints
- 0 <= n <= 100
- -100 <= Node.val <= 100

### Sample Test 1
```input
7
4 2 7 1 3 6 9
```
```output
4 7 2 9 6 3 1
```

### Sample Test 2
```input
3
2 1 3
```
```output
2 3 1
```

### Hidden Test 1
```input
0

```
```output

```

### Hidden Test 2
```input
5
1 2 3 null 4
```
```output
1 3 2 4
```
