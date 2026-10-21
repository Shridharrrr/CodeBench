---
slug: balanced-binary-tree
title: "Balanced Binary Tree"
difficulty: Easy
tags:
  - tree
  - depth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: K
points: 100
checker_type: token
---

# Balanced Binary Tree

Given a binary tree, determine if it is height-balanced.

A height-balanced binary tree is defined as a binary tree in which the left and right subtrees of every node differ in height by no more than 1.


### Constraints
- 0 <= n <= 5000
- -10^4 <= Node.val <= 10^4

### Sample Test 1
```input
7
3 9 20 null null 15 7
```
```output
true
```

### Sample Test 2
```input
7
1 2 2 3 3 null null 4 4
```
```output
false
```

### Hidden Test 1
```input
0

```
```output
true
```

### Hidden Test 2
```input
1
1
```
```output
true
```
