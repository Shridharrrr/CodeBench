# LRU Cache

Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.

Implement the operations:
- `get key`: Returns the value of the `key` if the key exists, otherwise returns `-1`.
- `put key value`: Updates the value of the `key` if the `key` exists. Otherwise, adds the `key-value` pair to the cache. If the number of keys exceeds the `capacity` from this operation, evict the least recently used key.

The functions `get` and `put` must each run in $O(1)$ average time complexity.

## Input Format
The first line contains two integers: `capacity` ($C$) and the number of queries ($Q$).
The next $Q$ lines contain one operation per line:
- `put key value`
- `get key`

## Output Format
For every `get` query, print the returned value on a new line.

## Constraints
- $1 \le C \le 10^4$
- $1 \le Q \le 10^5$
- $0 \le key \le 10^9$
- $0 \le value \le 10^9$

## Sample 1
### Input
```text
2 6
put 1 1
put 2 2
get 1
put 3 3
get 2
get 3
```
### Output
```text
1
-1
3
```
Explanation:
- `put 1 1`, `put 2 2`
- `get 1` returns 1 (key 1 is now most recently used)
- `put 3 3` evicts key 2 (least recently used)
- `get 2` returns -1 (not found)
- `get 3` returns 3
