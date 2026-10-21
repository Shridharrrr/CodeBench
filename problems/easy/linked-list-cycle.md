---
slug: linked-list-cycle
title: "Linked List Cycle"
difficulty: Easy
tags:
  - hash-table
  - linked-list
  - two-pointers
time_limit_ms: 1000
memory_mb: 256
contest_label: L
points: 100
checker_type: token
---

# Linked List Cycle

Given `head`, the head of a linked list, determine if the linked list has a cycle in it.

There is a cycle in a linked list if there is some node in the list that can be reached again by continuously following the `next` pointer.


### Constraints
- 0 <= n <= 10^4
- -10^5 <= Node.val <= 10^5
- pos is -1 or a valid 0-based index in the linked list.

### Sample Test 1
```input
4 1
3 2 0 -4
```
```output
true
```

### Sample Test 2
```input
2 0
1 2
```
```output
true
```

### Hidden Test 1
```input
1 -1
1
```
```output
false
```

### Hidden Test 2
```input
0 -1

```
```output
false
```
