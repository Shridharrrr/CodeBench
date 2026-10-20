---
slug: jump-game
title: "Jump Game"
difficulty: Medium
tags:
  - array
  - dynamic-programming
  - greedy
time_limit_ms: 1000
memory_mb: 256
contest_label: P
points: 200
checker_type: token
---

# Jump Game

You are given an integer array `nums`. You are initially positioned at the array's first index, and each element in the array represents your maximum jump length at that position.

Return `true` if you can reach the last index, or `false` otherwise.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers.

### Output Format
Print `true` if you can reach the last index, otherwise `false`.

### Constraints
- 1 <= n <= 10^4
- 0 <= nums[i] <= 10^5

### Sample Test 1
```input
5
2 3 1 1 4
```
```output
true
```

### Sample Test 2
```input
5
3 2 1 0 4
```
```output
false
```

### Hidden Test 1
```input
1
0
```
```output
true
```

### Hidden Test 2
```input
4
1 2 0 1
```
```output
true
```
