---
slug: word-ladder
title: "Word Ladder"
difficulty: Hard
tags:
  - hash-table
  - string
  - breadth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: H
points: 300
checker_type: token
---

# Word Ladder

A transformation sequence from word `beginWord` to word `endWord` using a dictionary `wordList` is a sequence of words `beginWord -> s_1 -> s_2 -> ... -> s_k` such that:
- Every adjacent pair of words differs by a single letter.
- Every `s_i` for `1 <= i <= k` is in `wordList`. Note that `beginWord` does not need to be in `wordList`.
- `s_k == endWord`

Given two words, `beginWord` and `endWord`, and a dictionary `wordList`, return the number of words in the shortest transformation sequence from `beginWord` to `endWord`, or `0` if no such sequence exists.

### Input Format
The first line contains `beginWord` and `endWord`.
The second line contains `n`.
The third line contains `n` space-separated words in `wordList`.

### Output Format
Print the length of the shortest transformation sequence, or 0.

### Constraints
- 1 <= beginWord.length <= 10
- endWord.length == beginWord.length
- 1 <= wordList.length <= 5000
- All strings consist of lowercase English letters and all words in wordList are unique.

### Sample Test 1
```input
hit cog
6
hot dot dog lot log cog
```
```output
5
```

### Sample Test 2
```input
hit cog
5
hot dot dog lot log
```
```output
0
```

### Hidden Test 1
```input
a c
3
a b c
```
```output
2
```

### Hidden Test 2
```input
hot dog
3
hot dot dog
```
```output
3
```
