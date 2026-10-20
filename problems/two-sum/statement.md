# Two Sum

Given an array of integers `nums` and an integer `target`, return the 0-based indices of the two numbers such that they add up to `target`.

You may assume that each input has **exactly one solution**, and you may not use the same element twice.

You can return the answer with the indices in increasing order.

### Input Format
- The first line contains an integer $N$ ($2 \le N \le 10^5$), the size of the array, and an integer $T$ ($-10^9 \le T \le 10^9$), the target sum.
- The second line contains $N$ space-separated integers $nums[i]$ ($-10^9 \le nums[i] \le 10^9$).

### Output Format
- Print two space-separated integers representing the 0-based indices $i$ and $j$ ($i < j$) such that $nums[i] + nums[j] = T$.

### Constraints
- $2 \le N \le 10^5$
- $-10^9 \le nums[i] \le 10^9$
- $-10^9 \le target \le 10^9$
- Exactly one valid answer exists.

### Example 1
**Input:**
```
4 9
2 7 11 15
```

**Output:**
```
0 1
```
**Explanation:** `nums[0] + nums[1] == 2 + 7 == 9`, so we output `0 1`.
