---
slug: coin-change
title: "Coin Change"
difficulty: Medium
tags:
  - array
  - dynamic-programming
  - breadth-first-search
time_limit_ms: 1000
memory_mb: 256
contest_label: AB
points: 200
checker_type: token
---

# Coin Change

You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.

Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.

You may assume that you have an infinite number of each kind of coin.


### Constraints
- 1 <= n <= 12
- 1 <= coins[i] <= 2^31 - 1
- 0 <= amount <= 10^4

### Sample Test 1
```input
3 11
1 2 5
```
```output
3
```

### Sample Test 2
```input
1 3
2
```
```output
-1
```

### Hidden Test 1
```input
1 0
1
```
```output
0
```

### Hidden Test 2
```input
3 6249
186 419 83
```
```output
20
```
