---
slug: reverse-linked-list
title: "Reverse Linked List"
difficulty: Easy
tags:
  - linked-list
  - recursion
time_limit_ms: 1000
memory_mb: 256
contest_label: P
points: 100
checker_type: token
---

# Reverse Linked List

Given the head of a singly linked list, reverse the list, and return the reversed list.

### Input Format
The first line contains an integer `n` representing the number of elements.
The second line contains `n` space-separated integers representing the list nodes.

### Output Format
Print the reversed list as space-separated integers.

### Constraints
- 0 <= n <= 5000
- -5000 <= Node.val <= 5000

### Sample Test 1
```input
5
1 2 3 4 5
```
```output
5 4 3 2 1
```

### Sample Test 2
```input
2
1 2
```
```output
2 1
```

### Hidden Test 1
```input
0

```
```output

```

### Hidden Test 2
```input
1
42
```
```output
42
```
