# Maximum Subarray

Given an integer array `nums`, find the subarray with the largest sum, and return its sum.

A **subarray** is a contiguous non-empty sequence of elements within an array.

## Input Format
The first line contains an integer $n$.
The second line contains $n$ space-separated integers representing `nums`.

## Output Format
Print the largest sum among all non-empty contiguous subarrays.

## Constraints
- $1 \le n \le 10^5$
- $-10^4 \le nums[i] \le 10^4$

## Sample 1
### Input
```text
9
-2 1 -3 4 -1 2 1 -5 4
```
### Output
```text
6
```
Explanation: The subarray `[4, -1, 2, 1]` has the largest sum `6`.

## Sample 2
### Input
```text
5
5 4 -1 7 8
```
### Output
```text
23
```
