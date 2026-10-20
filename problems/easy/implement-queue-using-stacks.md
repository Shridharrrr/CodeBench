---
slug: implement-queue-using-stacks
title: "Implement Queue using Stacks"
difficulty: Easy
tags:
  - stack
  - design
  - queue
time_limit_ms: 1000
memory_mb: 256
contest_label: M
points: 100
checker_type: token
---

# Implement Queue using Stacks

Implement a first in first out (FIFO) queue using only two stacks. The implemented queue should support all the functions of a normal queue (`push`, `pop`, `peek`, and `empty`).

### Input Format
The first line contains an integer `q` denoting the number of operations.
The next `q` lines describe operations:
- `push x`
- `pop`
- `peek`
- `empty`

### Output Format
For each `pop`, `peek`, and `empty` operation, print the resulting value on a new line.

### Constraints
- 1 <= q <= 100
- 1 <= x <= 9
- At most 100 calls will be made to push, pop, peek, and empty.

### Sample Test 1
```input
5
push 1
push 2
peek
pop
empty
```
```output
1
1
false
```

### Sample Test 2
```input
3
push 5
empty
pop
```
```output
false
5
```

### Hidden Test 1
```input
4
push 10
push 20
peek
pop
```
```output
10
10
```

### Hidden Test 2
```input
2
push 42
empty
```
```output
false
```
