---
slug: generate-parentheses
title: "Generate Parentheses"
difficulty: Medium
tags:
  - string
  - dynamic-programming
  - backtracking
time_limit_ms: 1000
memory_mb: 256
contest_label: G
points: 200
checker_type: token
---

# Generate Parentheses

Given `n` pairs of parentheses, write a function to generate all combinations of well-formed parentheses.

Print each combination on a new line in lexicographical order.


### Constraints
- 1 <= n <= 8

### Sample Test 1
```input
3
```
```output
((()))
(()())
(())()
()(())
()()()
```

### Sample Test 2
```input
1
```
```output
()
```

### Hidden Test 1
```input
2
```
```output
(())
()()
```

### Hidden Test 2
```input
4
```
```output
(((())))
((()()))
((())())
((()))()
(()(()))
(()()())
(()())()
(())(())
(())()()
()((()))
()(()())
()(())()
()()(())
()()()()
```
