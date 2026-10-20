---
slug: validate-binary-search-tree
title: "Validate Binary Search Tree"
difficulty: Medium
tags:
  - tree
  - depth-first-search
  - bst
time_limit_ms: 1000
memory_mb: 256
contest_label: V
points: 200
checker_type: token
---

# Validate Binary Search Tree

Given the root of a binary tree, determine if it is a valid binary search tree (BST).

A valid BST is defined as follows:
- The left subtree of a node contains only nodes with keys strictly less than the node's key.
- The right subtree of a node contains only nodes with keys strictly greater than the node's key.
- Both the left and right subtrees must also be binary search trees.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated elements representing the level-order traversal (`null` for empty child).

### Output Format
Print `true` if valid BST, otherwise `false`.

### Constraints
- 1 <= n <= 10^4
- -2^31 <= Node.val <= 2^31 - 1

### Sample Test 1
```input
3
2 1 3
```
```output
true
```

### Sample Test 2
```input
5
5 1 4 null null 3 6
```
```output
false
```

### Hidden Test 1
```input
1
10
```
```output
true
```

### Hidden Test 2
```input
3
2 2 2
```
```output
false
```
