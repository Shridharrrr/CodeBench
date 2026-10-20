---
slug: valid-anagram
title: "Valid Anagram"
difficulty: Easy
tags:
  - hash-table
  - string
  - sorting
time_limit_ms: 1000
memory_mb: 256
contest_label: G
points: 100
checker_type: token
---

# Valid Anagram

Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.

An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

### Input Format
Two lines: the first contains `s` and the second contains `t`.

### Output Format
Print `true` if anagram, otherwise `false`.

### Constraints
- 1 <= s.length, t.length <= 5 * 10^4
- s and t consist of lowercase English letters.

### Sample Test 1
```input
anagram
nagaram
```
```output
true
```

### Sample Test 2
```input
rat
car
```
```output
false
```

### Hidden Test 1
```input
a
a
```
```output
true
```

### Hidden Test 2
```input
ab
a
```
```output
false
```
