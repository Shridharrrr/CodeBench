---
slug: word-search
title: "Word Search"
difficulty: Medium
tags:
  - array
  - backtracking
  - matrix
time_limit_ms: 1000
memory_mb: 256
contest_label: T
points: 200
checker_type: token
---

# Word Search

Given an `m x n` grid of characters `board` and a string `word`, return `true` if `word` exists in the grid.

The word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.

### Input Format
The first line contains `m` and `n`.
The next `m` lines contain `n` characters separated by spaces.
The last line contains the string `word`.

### Output Format
Print `true` if word exists, otherwise `false`.

### Constraints
- 1 <= m, n <= 6
- 1 <= word.length <= 15
- board and word consist of only lowercase and uppercase English letters.

### Sample Test 1
```input
3 4
A B C E
S F C S
A D E E
ABCCED
```
```output
true
```

### Sample Test 2
```input
3 4
A B C E
S F C S
A D E E
ABCB
```
```output
false
```

### Hidden Test 1
```input
3 4
A B C E
S F C S
A D E E
SEE
```
```output
true
```

### Hidden Test 2
```input
1 1
a
b
```
```output
false
```
