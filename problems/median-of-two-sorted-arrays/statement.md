# Median of Two Sorted Arrays

Given two sorted arrays `nums1` and `nums2` of size $m$ and $n$ respectively, return the **median** of the two sorted arrays.

The overall run time complexity should be $O(\log(m+n))$.

## Input Format
- Line 1: integer $m$
- Line 2: $m$ space-separated integers for `nums1`
- Line 3: integer $n$
- Line 4: $n$ space-separated integers for `nums2`

## Output Format
Print a single floating-point number representing the median. Answers within an absolute or relative error of $10^{-5}$ will be accepted.

## Constraints
- $0 \le m \le 10^5$
- $0 \le n \le 10^5$
- $1 \le m + n \le 2 \cdot 10^5$
- $-10^6 \le nums1[i], nums2[i] \le 10^6$

## Sample 1
### Input
```text
2
1 3
1
2
```
### Output
```text
2.0
```

## Sample 2
### Input
```text
2
1 2
2
3 4
```
### Output
```text
2.5
```
