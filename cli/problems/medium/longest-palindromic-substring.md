---
slug: longest-palindromic-substring
title: "Longest Palindromic Substring"
difficulty: Medium
tags:
  - two-pointers
  - string
  - dynamic-programming
time_limit_ms: 1000
memory_mb: 256
contest_label: C
points: 200
checker_type: token
---

# Longest Palindromic Substring

Given a string `s`, return the longest palindromic substring in `s`. If there are multiple answers with the same maximum length, return the one that appears earliest.


### Constraints
- 1 <= s.length <= 1000
- s consist of only digits and English letters.

### Sample Test 1
```input
babad
```
```output
bab
```

### Sample Test 2
```input
cbbd
```
```output
bb
```

### Hidden Test 1
```input
a
```
```output
a
```

### Hidden Test 2
```input
ac
```
```output
a
```
