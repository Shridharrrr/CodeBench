---
slug: remove-nth-node-from-end-of-list
title: "Remove Nth Node From End of List"
difficulty: Medium
tags:
  - linked-list
  - two-pointers
time_limit_ms: 1000
memory_mb: 256
contest_label: F
points: 200
checker_type: token
---

# Remove Nth Node From End of List

Given the head of a linked list, remove the `n`-th node from the end of the list and return its head.


### Constraints
- 1 <= len <= 30
- 0 <= Node.val <= 100
- 1 <= n <= len

### Sample Test 1
```input
5 2
1 2 3 4 5
```
```output
1 2 3 5
```

### Sample Test 2
```input
1 1
1
```
```output

```

### Hidden Test 1
```input
2 1
1 2
```
```output
1
```

### Hidden Test 2
```input
3 3
10 20 30
```
```output
20 30
```
