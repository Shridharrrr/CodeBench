# Binary Search

Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index (0-indexed). Otherwise, return `-1`.

You must write an algorithm with $O(\log n)$ runtime complexity.

## Input Format
The first line contains two integers $n$ and $target$.
The second line contains $n$ space-separated integers representing `nums`.

## Output Format
Print the 0-based index of `target`, or `-1` if it is not present.

## Constraints
- $1 \le n \le 10^6$
- $-10^9 \le nums[i], target \le 10^9$
- All the integers in `nums` are unique.
- `nums` is sorted in ascending order.

## Sample 1
### Input
```text
6 9
-1 0 3 5 9 12
```
### Output
```text
4
```

## Sample 2
### Input
```text
6 2
-1 0 3 5 9 12
```
### Output
```text
-1
```
