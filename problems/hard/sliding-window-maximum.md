---
slug: sliding-window-maximum
title: "Sliding Window Maximum"
difficulty: Hard
tags:
  - array
  - queue
  - sliding-window
  - monotonic-queue
time_limit_ms: 1000
memory_mb: 256
contest_label: J
points: 300
checker_type: token
---

# Sliding Window Maximum

You are given an array of integers `nums`, there is a sliding window of size `k` which is moving from the very left of the array to the very right. You can only see the `k` numbers in the window. Each time the sliding window moves right by one position.

Return the max sliding window as an array of integers.

### Input Format
The first line contains `n` and `k`.
The second line contains `n` space-separated integers.

### Output Format
Print the maximum values for each window position separated by spaces.

### Constraints
- 1 <= n <= 10^5
- 1 <= k <= n
- -10^4 <= nums[i] <= 10^4

### Sample Test 1
```input
8 3
1 3 -1 -3 5 3 6 7
```
```output
3 3 5 5 6 7
```

### Sample Test 2
```input
1 1
1
```
```output
1
```

### Hidden Test 1
```input
2 1
1 -1
```
```output
1 -1
```

### Hidden Test 2
```input
4 2
9 11 8 5 7 10
```
```output
11 11 8 7 10
```
