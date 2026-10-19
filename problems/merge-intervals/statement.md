# Merge Intervals

Given an array of intervals where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input, sorted by start time.

## Input Format
The first line contains an integer $n$.
The next $n$ lines each contain two integers: $start_i$ and $end_i$.

## Output Format
The first line should contain $m$, the number of merged intervals.
The next $m$ lines should contain two integers per line: the merged $start$ and $end$.

## Constraints
- $1 \le n \le 10^5$
- $0 \le start_i \le end_i \le 10^9$

## Sample 1
### Input
```text
4
1 3
2 6
8 10
15 18
```
### Output
```text
3
1 6
8 10
15 18
```

## Sample 2
### Input
```text
2
1 4
4 5
```
### Output
```text
1
1 5
```
