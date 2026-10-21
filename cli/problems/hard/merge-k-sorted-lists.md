---
slug: merge-k-sorted-lists
title: "Merge k Sorted Lists"
difficulty: Hard
tags:
  - linked-list
  - divide-and-conquer
  - heap
time_limit_ms: 1000
memory_mb: 256
contest_label: C
points: 300
checker_type: token
---

# Merge k Sorted Lists

You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.

Merge all the linked-lists into one sorted linked-list and return it.


### Constraints
- 0 <= k <= 10^4
- 0 <= len <= 500
- -10^4 <= Node.val <= 10^4
- The sum of len across all lists will not exceed 10^4.

### Sample Test 1
```input
3
3 1 4 5
3 1 3 4
2 2 6
```
```output
1 1 2 3 4 4 5 6
```

### Sample Test 2
```input
0
```
```output

```

### Hidden Test 1
```input
1
0
```
```output

```

### Hidden Test 2
```input
2
2 1 3
3 2 4 5
```
```output
1 2 3 4 5
```
