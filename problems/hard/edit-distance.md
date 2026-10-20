---
slug: edit-distance
title: "Edit Distance"
difficulty: Hard
tags:
  - string
  - dynamic-programming
time_limit_ms: 1000
memory_mb: 256
contest_label: F
points: 300
checker_type: token
---

# Edit Distance

Given two strings `word1` and `word2`, return the minimum number of operations required to convert `word1` to `word2`.

You have the following three operations permitted on a word:
- Insert a character
- Delete a character
- Replace a character

### Input Format
Two lines: the first contains `word1` and the second contains `word2`.

### Output Format
Print the minimum edit distance as an integer.

### Constraints
- 0 <= word1.length, word2.length <= 500
- word1 and word2 consist of lowercase English letters.

### Sample Test 1
```input
horse
ros
```
```output
3
```

### Sample Test 2
```input
intention
execution
```
```output
5
```

### Hidden Test 1
```input
a
b
```
```output
1
```

### Hidden Test 2
```input
abc

```
```output
3
```
