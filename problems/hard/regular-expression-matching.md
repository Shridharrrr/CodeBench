---
slug: regular-expression-matching
title: "Regular Expression Matching"
difficulty: Hard
tags:
  - string
  - dynamic-programming
  - recursion
time_limit_ms: 1000
memory_mb: 256
contest_label: B
points: 300
checker_type: token
---

# Regular Expression Matching

Given an input string `s` and a pattern `p`, implement regular expression matching with support for `'.'` and `'*'` where:
- `'.'` Matches any single character.
- `'*'` Matches zero or more of the preceding element.

The matching should cover the entire input string (not partial).


### Constraints
- 1 <= s.length <= 20
- 1 <= p.length <= 20
- s contains only lowercase English letters.
- p contains only lowercase English letters, '.', and '*'.

### Sample Test 1
```input
aa
a
```
```output
false
```

### Sample Test 2
```input
aa
a*
```
```output
true
```

### Hidden Test 1
```input
ab
.*
```
```output
true
```

### Hidden Test 2
```input
aab
c*a*b
```
```output
true
```
