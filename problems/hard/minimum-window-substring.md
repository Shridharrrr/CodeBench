---
slug: minimum-window-substring
title: "Minimum Window Substring"
difficulty: Hard
tags:
  - hash-table
  - string
  - sliding-window
time_limit_ms: 1000
memory_mb: 256
contest_label: G
points: 300
checker_type: token
---

# Minimum Window Substring

Given two strings `s` and `t` of lengths `m` and `n` respectively, return the minimum window substring of `s` such that every character in `t` (including duplicates) is included in the window. If there is no such substring, return the empty string.

The testcases will be generated such that the answer is unique.

### Input Format
Two lines: the first contains `s` and the second contains `t`.

### Output Format
Print the minimum window substring (or empty line if none).

### Constraints
- 1 <= m, n <= 10^5
- s and t consist of uppercase and lowercase English letters.

### Sample Test 1
```input
ADOBECODEBANC
ABC
```
```output
BANC
```

### Sample Test 2
```input
a
a
```
```output
a
```

### Hidden Test 1
```input
a
aa
```
```output

```

### Hidden Test 2
```input
ab
b
```
```output
b
```
