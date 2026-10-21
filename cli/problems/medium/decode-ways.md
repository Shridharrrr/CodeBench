---
slug: decode-ways
title: "Decode Ways"
difficulty: Medium
tags:
  - string
  - dynamic-programming
time_limit_ms: 1000
memory_mb: 256
contest_label: U
points: 200
checker_type: token
---

# Decode Ways

A message containing letters from A-Z can be encoded into numbers using the following mapping:
'A' -> "1", 'B' -> "2", ..., 'Z' -> "26".

To decode an encoded message, all the digits must be grouped then mapped back into letters using the reverse of the mapping. Given a string `s` containing only digits, return the number of ways to decode it.


### Constraints
- 1 <= s.length <= 100
- s contains only digits and may contain leading zero(s).

### Sample Test 1
```input
12
```
```output
2
```

### Sample Test 2
```input
226
```
```output
3
```

### Hidden Test 1
```input
06
```
```output
0
```

### Hidden Test 2
```input
10
```
```output
1
```
