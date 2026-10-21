---
slug: valid-parentheses
title: "Valid Parentheses"
difficulty: Easy
tags:
  - string
  - stack
time_limit_ms: 1000
memory_mb: 256
contest_label: B
points: 100
checker_type: token
---

# Valid Parentheses

Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.


### Constraints
- 1 <= s.length <= 10^4
- s consists of parentheses only: '()[]{}'.

### Sample Test 1
```input
()
```
```output
true
```

### Sample Test 2
```input
()[]{}
```
```output
true
```

### Hidden Test 1
```input
(]
```
```output
false
```

### Hidden Test 2
```input
([)]
```
```output
false
```
