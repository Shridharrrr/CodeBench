---
slug: valid-palindrome
title: "Valid Palindrome"
difficulty: Easy
tags:
  - two-pointers
  - string
time_limit_ms: 1000
memory_mb: 256
contest_label: E
points: 100
checker_type: token
---

# Valid Palindrome

A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string `s`, return `true` if it is a palindrome, or `false` otherwise.


### Constraints
- 1 <= s.length <= 2 * 10^5
- s consists only of printable ASCII characters.

### Sample Test 1
```input
A man, a plan, a canal: Panama
```
```output
true
```

### Sample Test 2
```input
race a car
```
```output
false
```

### Hidden Test 1
```input
 
```
```output
true
```

### Hidden Test 2
```input
0P
```
```output
false
```
