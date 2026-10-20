---
slug: longest-palindrome
title: "Longest Palindrome"
difficulty: Easy
tags:
  - hash-table
  - string
  - greedy
time_limit_ms: 1000
memory_mb: 256
contest_label: O
points: 100
checker_type: token
---

# Longest Palindrome

Given a string `s` which consists of lowercase or uppercase letters, return the length of the longest palindrome that can be built with those letters.

Letters are case-sensitive, for example, `"Aa"` is not considered a palindrome.

### Input Format
A single line containing the string `s`.

### Output Format
Print an integer representing the maximum length of a palindrome that can be built.

### Constraints
- 1 <= s.length <= 2000
- s consists of lowercase and/or uppercase English letters only.

### Sample Test 1
```input
abccccdd
```
```output
7
```

### Sample Test 2
```input
a
```
```output
1
```

### Hidden Test 1
```input
bb
```
```output
2
```

### Hidden Test 2
```input
bananas
```
```output
5
```
