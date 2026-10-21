---
slug: lowest-common-ancestor-of-a-bst
title: "Lowest Common Ancestor of a BST"
difficulty: Easy
tags:
  - tree
  - depth-first-search
  - bst
time_limit_ms: 1000
memory_mb: 256
contest_label: J
points: 100
checker_type: token
---

# Lowest Common Ancestor of a BST

Given a binary search tree (BST), find the lowest common ancestor (LCA) node of two given nodes in the BST.

According to the definition of LCA on Wikipedia: “The lowest common ancestor is defined between two nodes `p` and `q` as the lowest node in `T` that has both `p` and `q` as descendants (where we allow a node to be a descendant of itself).”


### Constraints
- 2 <= n <= 10^5
- -10^9 <= Node.val <= 10^9
- All Node.val are unique.
- p and q exist in the BST and p != q.

### Sample Test 1
```input
9 2 8
6 2 8 0 4 7 9 null null 3 5
```
```output
6
```

### Sample Test 2
```input
9 2 4
6 2 8 0 4 7 9 null null 3 5
```
```output
2
```

### Hidden Test 1
```input
2 1 2
2 1
```
```output
2
```

### Hidden Test 2
```input
5 3 5
4 2 6 1 3 null 5
```
```output
4
```
