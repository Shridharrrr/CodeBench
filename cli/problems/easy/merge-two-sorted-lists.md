---
slug: merge-two-sorted-lists
title: "Merge Two Sorted Lists"
difficulty: Easy
tags:
  - linked-list
  - two-pointers
time_limit_ms: 1000
memory_mb: 256
contest_label: C
points: 100
checker_type: token
---

# Merge Two Sorted Lists

You are given the heads of two sorted lists of integers, `list1` and `list2`.

Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.


### Constraints
- 0 <= n, m <= 100
- -100 <= Node.val <= 100
- Both lists are sorted in non-decreasing order.

### Sample Test 1
```input
3 3
1 2 4
1 3 4
```
```output
1 1 2 3 4 4
```

### Sample Test 2
```input
0 1

0
```
```output
0
```

### Hidden Test 1
```input
0 0


```
```output

```

### Hidden Test 2
```input
2 4
2 5
1 3 4 7
```
```output
1 2 3 4 5 7
```
