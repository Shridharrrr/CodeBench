---
slug: group-anagrams
title: "Group Anagrams"
difficulty: Medium
tags:
  - array
  - hash-table
  - string
  - sorting
time_limit_ms: 1000
memory_mb: 256
contest_label: M
points: 200
checker_type: token
---

# Group Anagrams

Given an array of strings `strs`, group the anagrams together. You can return the answer in any order, but words within each group should be sorted alphabetically, and groups should be sorted by the first word.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated words.

### Output Format
Print each group on a new line with space-separated words.

### Constraints
- 1 <= n <= 10^4
- 0 <= strs[i].length <= 100
- strs[i] consists of lowercase English letters.

### Sample Test 1
```input
6
eat tea tan ate nat bat
```
```output
ate eat tea
bat
nat tan
```

### Sample Test 2
```input
1
a
```
```output
a
```

### Hidden Test 1
```input
2
ab ba
```
```output
ab ba
```

### Hidden Test 2
```input
4
stop tops pots step
```
```output
pots stop tops
step
```
