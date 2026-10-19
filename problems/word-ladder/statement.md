# Word Ladder

A **transformation sequence** from word `beginWord` to word `endWord` using a dictionary `wordList` is a sequence of words `beginWord -> s_1 -> s_2 -> ... -> s_k` such that:
- Every adjacent pair of words differs by a single letter.
- Every $s_i$ for $1 \le i \le k$ is in `wordList`. Note that `beginWord` does not need to be in `wordList`.
- $s_k == endWord$.

Given two words, `beginWord` and `endWord`, and a dictionary `wordList`, return the **number of words** in the shortest transformation sequence from `beginWord` to `endWord`, or `0` if no such sequence exists.

## Input Format
The first line contains two space-separated strings: `beginWord` and `endWord`.
The second line contains an integer $n$.
The third line contains $n$ space-separated words representing `wordList`.

## Output Format
Print a single integer: the number of words in the shortest transformation sequence, or `0` if none exists.

## Constraints
- $1 \le \text{length of each word} \le 10$
- `beginWord` and `endWord` consist of lowercase English letters.
- `beginWord` $\ne$ `endWord`.
- All the words in `wordList` are unique.
- $1 \le n \le 5000$.

## Sample 1
### Input
```text
hit cog
6
hot dot dog lot log cog
```
### Output
```text
5
```
Explanation: One shortest transformation sequence is `hit -> hot -> dot -> dog -> cog`, which has 5 words.

## Sample 2
### Input
```text
hit cog
5
hot dot dog lot log
```
### Output
```text
0
```
Explanation: The endWord `cog` is not in `wordList`, so there is no valid transformation sequence.
