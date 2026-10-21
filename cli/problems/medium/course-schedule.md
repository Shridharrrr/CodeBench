---
slug: course-schedule
title: "Course Schedule"
difficulty: Medium
tags:
  - depth-first-search
  - breadth-first-search
  - graph
  - topological-sort
time_limit_ms: 1000
memory_mb: 256
contest_label: AD
points: 200
checker_type: token
---

# Course Schedule

There are a total of `numCourses` courses you have to take, labeled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [a_i, b_i]` indicates that you must take course `b_i` first if you want to take course `a_i`.

Return `true` if you can finish all courses. Otherwise, return `false`.


### Constraints
- 1 <= numCourses <= 2000
- 0 <= m <= 5000
- prerequisites[i].length == 2
- 0 <= a_i, b_i < numCourses
- All pairs [a_i, b_i] are unique.

### Sample Test 1
```input
2 1
1 0
```
```output
true
```

### Sample Test 2
```input
2 2
1 0
0 1
```
```output
false
```

### Hidden Test 1
```input
3 2
1 0
2 1
```
```output
true
```

### Hidden Test 2
```input
4 4
1 0
2 1
3 2
1 3
```
```output
false
```
