---
slug: letter-combinations-of-a-phone-number
title: "Letter Combinations of a Phone Number"
difficulty: Medium
tags:
  - hash-table
  - string
  - backtracking
time_limit_ms: 1000
memory_mb: 256
contest_label: E
points: 200
checker_type: token
---

# Letter Combinations of a Phone Number

Given a string containing digits from `2-9` inclusive, return all possible letter combinations that the number could represent. Return the answer in lexicographical order.

A mapping of digits to letters (just like on telephone buttons) is given below:
2: abc, 3: def, 4: ghi, 5: jkl, 6: mno, 7: pqrs, 8: tuv, 9: wxyz.

### Input Format
A single line containing the digits string.

### Output Format
Print space-separated strings of all letter combinations in lexicographical order.

### Constraints
- 0 <= digits.length <= 4
- digits[i] is a digit in the range ['2', '9'].

### Sample Test 1
```input
23
```
```output
ad ae af bd be bf cd ce cf
```

### Sample Test 2
```input
2
```
```output
a b c
```

### Hidden Test 1
```input

```
```output

```

### Hidden Test 2
```input
79
```
```output
pw px py pz qw qx qy qz rw rx ry rz sw sx sy sz
```
