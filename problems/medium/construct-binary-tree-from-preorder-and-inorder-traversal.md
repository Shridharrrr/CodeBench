---
slug: construct-binary-tree-from-preorder-and-inorder-traversal
title: "Construct Binary Tree from Preorder and Inorder Traversal"
difficulty: Medium
tags:
  - array
  - hash-table
  - divide-and-conquer
  - tree
time_limit_ms: 1000
memory_mb: 256
contest_label: X
points: 200
checker_type: token
---

# Construct Binary Tree from Preorder and Inorder Traversal

Given two integer arrays `preorder` and `inorder` where `preorder` is the preorder traversal of a binary tree and `inorder` is the inorder traversal of the same tree, construct and return the binary tree's postorder traversal.


### Constraints
- 1 <= n <= 3000
- -3000 <= preorder[i], inorder[i] <= 3000
- All values are unique.

### Sample Test 1
```input
5
3 9 20 15 7
9 3 15 20 7
```
```output
9 15 7 20 3
```

### Sample Test 2
```input
1
-1
-1
```
```output
-1
```

### Hidden Test 1
```input
3
1 2 3
2 1 3
```
```output
2 3 1
```

### Hidden Test 2
```input
4
1 2 4 3
4 2 1 3
```
```output
4 2 3 1
```
