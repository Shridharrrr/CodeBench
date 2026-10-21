---
slug: kth-smallest-element-in-a-bst
title: "Kth Smallest Element in a BST"
difficulty: Medium
tags:
  - tree
  - depth-first-search
  - bst
time_limit_ms: 1000
memory_mb: 256
contest_label: Y
points: 200
checker_type: token
---

# Kth Smallest Element in a BST

Given the root of a binary search tree, and an integer `k`, return the `k`-th smallest value (1-indexed) of all the values of the nodes in the tree.


### Constraints
- 1 <= k <= n <= 10^4
- 0 <= Node.val <= 10^4

### Sample Test 1
```input
4 1
3 1 4 null 2
```
```output
1
```

### Sample Test 2
```input
6 3
5 3 6 2 4 null null 1
```
```output
3
```

### Hidden Test 1
```input
1 1
42
```
```output
42
```

### Hidden Test 2
```input
3 2
2 1 3
```
```output
2
```
