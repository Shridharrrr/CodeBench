---
slug: product-of-array-except-self
title: "Product of Array Except Self"
difficulty: Medium
tags:
  - array
  - prefix-sum
time_limit_ms: 1000
memory_mb: 256
contest_label: AA
points: 200
checker_type: token
---

# Product of Array Except Self

Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`.

The product of any prefix or suffix of `nums` is guaranteed to fit in a 32-bit integer.

You must write an algorithm that runs in $O(n)$ time and without using the division operation.

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers.

### Output Format
Print `answer` as space-separated integers.

### Constraints
- 2 <= n <= 10^5
- -30 <= nums[i] <= 30
- The product of any prefix or suffix fits in a 32-bit integer.

### Sample Test 1
```input
4
1 2 3 4
```
```output
24 12 8 6
```

### Sample Test 2
```input
5
-1 1 0 -3 3
```
```output
0 0 9 0 0
```

### Hidden Test 1
```input
2
5 2
```
```output
2 5
```

### Hidden Test 2
```input
3
2 3 4
```
```output
12 8 6
```
