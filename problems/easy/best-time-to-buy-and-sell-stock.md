---
slug: best-time-to-buy-and-sell-stock
title: "Best Time to Buy and Sell Stock"
difficulty: Easy
tags:
  - array
  - dynamic-programming
time_limit_ms: 1000
memory_mb: 256
contest_label: D
points: 100
checker_type: token
---

# Best Time to Buy and Sell Stock

You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`-th day.

You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.

Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.

### Input Format
The first line contains an integer `n` denoting the number of days.
The second line contains `n` space-separated integers representing stock prices.

### Output Format
Print the maximum profit achievable.

### Constraints
- 1 <= n <= 10^5
- 0 <= prices[i] <= 10^4

### Sample Test 1
```input
6
7 1 5 3 6 4
```
```output
5
```

### Sample Test 2
```input
5
7 6 4 3 1
```
```output
0
```

### Hidden Test 1
```input
2
2 4
```
```output
2
```

### Hidden Test 2
```input
8
3 2 6 5 0 3 8 1
```
```output
8
```
