---
slug: lowest-common-ancestor-of-a-binary-tree
title: "Lowest Common Ancestor of a Binary Tree"
difficulty: Medium
tags:
  - tree
  - depth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: Z
points: 200
checker_type: token
---

# Lowest Common Ancestor of a Binary Tree

Given a binary tree, find the lowest common ancestor (LCA) of two given nodes `p` and `q` in the tree.

According to the definition of LCA on Wikipedia: “The lowest common ancestor is defined between two nodes `p` and `q` as the lowest node in `T` that has both `p` and `q` as descendants (where we allow a node to be a descendant of itself).”

### Input Format
The first line contains `n`, `p`, and `q`.
The second line contains `n` space-separated level-order tokens.

### Output Format
Print the integer value of the lowest common ancestor.

### Constraints
- 2 <= n <= 10^5
- -10^9 <= Node.val <= 10^9
- All Node.val are unique.
- p and q exist in the tree and p != q.

### Sample Test 1
```input
9 5 1
3 5 1 6 2 0 8 null null 7 4
```
```output
3
```

### Sample Test 2
```input
9 5 4
3 5 1 6 2 0 8 null null 7 4
```
```output
5
```

### Hidden Test 1
```input
2 1 2
1 2
```
```output
1
```

### Hidden Test 2
```input
3 2 3
1 2 3
```
```output
1
```
