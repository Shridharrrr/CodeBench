---
slug: median-of-two-sorted-arrays
title: "Median of Two Sorted Arrays"
difficulty: Hard
tags:
  - array
  - binary-search
  - divide-and-conquer
time_limit_ms: 1000
memory_mb: 256
contest_label: A
points: 300
checker_type: token
---

# Median of Two Sorted Arrays

Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays.

The overall run time complexity should be $O(\log (m+n))$. Print the median formatted to 5 decimal places.

### Input Format
The first line contains `m` and `n`.
The second line contains `m` space-separated integers for `nums1`.
The third line contains `n` space-separated integers for `nums2`.

### Output Format
Print the median rounded to 5 decimal places (e.g. `2.00000`).

### Constraints
- 0 <= m, n <= 1000
- 1 <= m + n <= 2000
- -10^6 <= nums1[i], nums2[i] <= 10^6

### Sample Test 1
```input
2 1
1 3
2
```
```output
2.00000
```

### Sample Test 2
```input
2 2
1 2
3 4
```
```output
2.50000
```

### Hidden Test 1
```input
0 1

1
```
```output
1.00000
```

### Hidden Test 2
```input
4 3
1 2 5 6
3 4 7
```
```output
4.00000
```
