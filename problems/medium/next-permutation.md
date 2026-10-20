---
slug: next-permutation
title: "Next Permutation"
difficulty: Medium
tags:
  - array
  - two-pointers
time_limit_ms: 1000
memory_mb: 256
contest_label: H
points: 200
checker_type: token
---

# Next Permutation

A permutation of an array of integers is an arrangement of its members into a sequence or linear order.

The next permutation of an array of integers is the next lexicographically greater permutation of its integer. More formally, if all the permutations of the array are sorted in one container according to their lexicographical order then the next permutation of that array is the permutation that follows it in the sorted container. If such arrangement is not possible, the array must be rearranged as the lowest possible order (i.e., sorted in ascending order).

### Input Format
The first line contains `n`.
The second line contains `n` space-separated integers.

### Output Format
Print the next permutation separated by spaces.

### Constraints
- 1 <= n <= 100
- 0 <= nums[i] <= 100

### Sample Test 1
```input
3
1 2 3
```
```output
1 3 2
```

### Sample Test 2
```input
3
3 2 1
```
```output
1 2 3
```

### Hidden Test 1
```input
3
1 1 5
```
```output
1 5 1
```

### Hidden Test 2
```input
4
1 3 2 4
```
```output
1 3 4 2
```
