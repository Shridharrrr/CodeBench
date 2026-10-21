// Pure LeetCode function-based starter skeletons for contestants
// Participants submit only their class / function methods.

export interface ProblemStub {
  cpp: string;
  python: string;
  go: string;
  rust?: string;
  c?: string;
}

export const LEETCODE_STUBS: Record<string, ProblemStub> = {
  'two-sum': {
    cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        
    }
};`,
    python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        pass`,
    go: `func twoSum(nums []int, target int) []int {
    
}`,
  },

  'valid-palindrome': {
    cpp: `class Solution {
public:
    bool isPalindrome(string s) {
        
    }
};`,
    python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        pass`,
    go: `func isPalindrome(s string) bool {
    
}`,
  },

  'binary-search': {
    cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        
    }
};`,
    python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        pass`,
    go: `func search(nums []int, target int) int {
    
}`,
  },

  'maximum-subarray': {
    cpp: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        
    }
};`,
    python: `class Solution:
    def maxSubArray(self, nums: list[int]) -> int:
        pass`,
    go: `func maxSubArray(nums []int) int {
    
}`,
  },

  'longest-palindromic-substring': {
    cpp: `class Solution {
public:
    string longestPalindrome(string s) {
        
    }
};`,
    python: `class Solution:
    def longestPalindrome(self, s: str) -> str:
        pass`,
    go: `func longestPalindrome(s string) string {
    
}`,
  },

  'merge-intervals': {
    cpp: `class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        
    }
};`,
    python: `class Solution:
    def merge(self, intervals: list[list[int]]) -> list[list[int]]:
        pass`,
    go: `func merge(intervals [][]int) [][]int {
    
}`,
  },

  'trapping-rain-water': {
    cpp: `class Solution {
public:
    int trap(vector<int>& height) {
        
    }
};`,
    python: `class Solution:
    def trap(self, height: list[int]) -> int:
        pass`,
    go: `func trap(height []int) int {
    
}`,
  },

  'median-of-two-sorted-arrays': {
    cpp: `class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        
    }
};`,
    python: `class Solution:
    def findMedianSortedArrays(self, nums1: list[int], nums2: list[int]) -> float:
        pass`,
    go: `func findMedianSortedArrays(nums1 []int, nums2 []int) float64 {
    
}`,
  },

  'word-ladder': {
    cpp: `class Solution {
public:
    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {
        
    }
};`,
    python: `class Solution:
    def ladderLength(self, beginWord: str, endWord: str, wordList: list[str]) -> int:
        pass`,
    go: `func ladderLength(beginWord string, endWord string, wordList []string) int {
    
}`,
  },

  'lru-cache': {
    cpp: `class LRUCache {
public:
    LRUCache(int capacity) {
        
    }
    
    int get(int key) {
        
    }
    
    void put(int key, int value) {
        
    }
};`,
    python: `class LRUCache:
    def __init__(self, capacity: int):
        pass

    def get(self, key: int) -> int:
        pass

    def put(self, key: int, value: int) -> None:
        pass`,
    go: `type LRUCache struct {
    
}

func Constructor(capacity int) LRUCache {
    
}

func (this *LRUCache) Get(key int) int {
    
}

func (this *LRUCache) Put(key int, value int)  {
    
}`,
  },

  'best-time-to-buy-and-sell-stock': {
    cpp: `class Solution {
public:
    int maxProfit(vector<int>& prices) {
        
    }
};`,
    python: `class Solution:
    def maxProfit(self, prices: list[int]) -> int:
        pass`,
    go: `func maxProfit(prices []int) int {
    
}`,
  },

  'contains-duplicate': {
    cpp: `class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        
    }
};`,
    python: `class Solution:
    def containsDuplicate(self, nums: list[int]) -> bool:
        pass`,
    go: `func containsDuplicate(nums []int) bool {
    
}`,
  },

  'climbing-stairs': {
    cpp: `class Solution {
public:
    int climbStairs(int n) {
        
    }
};`,
    python: `class Solution:
    def climbStairs(self, n: int) -> int:
        pass`,
    go: `func climbStairs(n int) int {
    
}`,
  },

  'valid-parentheses': {
    cpp: `class Solution {
public:
    bool isValid(string s) {
        
    }
};`,
    python: `class Solution:
    def isValid(self, s: str) -> bool:
        pass`,
    go: `func isValid(s string) bool {
    
}`,
  },

  'single-number': {
    cpp: `class Solution {
public:
    int singleNumber(vector<int>& nums) {
        
    }
};`,
    python: `class Solution:
    def singleNumber(self, nums: list[int]) -> int:
        pass`,
    go: `func singleNumber(nums []int) int {
    
}`,
  },

  '3sum': {
    cpp: `class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        
    }
};`,
    python: `class Solution:
    def threeSum(self, nums: list[int]) -> list[list[int]]:
        pass`,
    go: `func threeSum(nums []int) [][]int {
    
}`,
  },

  'coin-change': {
    cpp: `class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        
    }
};`,
    python: `class Solution:
    def coinChange(self, coins: list[int], amount: int) -> int:
        pass`,
    go: `func coinChange(coins []int, amount int) int {
    
}`,
  },

  'product-of-array-except-self': {
    cpp: `class Solution {
public:
    vector<int> productExceptSelf(vector<int>& nums) {
        
    }
};`,
    python: `class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        pass`,
    go: `func productExceptSelf(nums []int) []int {
    
}`,
  },

  'reverse-linked-list': {
    cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        
    }
};`,
    python: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        pass`,
    go: `/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */
func reverseList(head *ListNode) *ListNode {
    
}`,
  },

  'merge-two-sorted-lists': {
    cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        
    }
};`,
    python: `class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        pass`,
    go: `func mergeTwoLists(list1 *ListNode, list2 *ListNode) *ListNode {
    
}`,
  },
};

function slugToMethodName(slug: string): string {
  const parts = slug.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'solve';
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export function getBoilerplate(slug: string, language: string): string {
  const cleanSlug = (slug || '').toLowerCase().trim();
  const lang = (language || 'cpp23-gcc').toLowerCase();

  // 1. Check direct stub match
  const stub = LEETCODE_STUBS[cleanSlug];
  if (stub) {
    if (lang.startsWith('python') || lang === 'py') {
      return stub.python;
    }
    if (lang.startsWith('go')) {
      return stub.go;
    }
    return stub.cpp;
  }

  // 2. Generic dynamic LeetCode template for any problem
  const methodName = slugToMethodName(cleanSlug);

  if (lang.startsWith('python') || lang === 'py') {
    return `class Solution:
    def ${methodName}(self, nums: list[int]) -> int:
        # Write your LeetCode solution here
        pass
`;
  }

  if (lang.startsWith('go')) {
    return `func ${methodName}(nums []int) int {
    // Write your LeetCode solution here
    return 0
}
`;
  }

  if (lang.startsWith('c23') || lang === 'c') {
    return `// LeetCode C solution
int ${methodName}(int* nums, int numsSize) {
    // Write your solution here
    return 0;
}
`;
  }

  if (lang === 'rust') {
    return `pub struct Solution;

impl Solution {
    pub fn ${cleanSlug.replace(/-/g, '_')}(nums: Vec<i32>) -> i32 {
        0
    }
}
`;
  }

  // Default C++ (cpp23-gcc / cpp23-clang)
  return `class Solution {
public:
    int ${methodName}(vector<int>& nums) {
        // Write your LeetCode solution here
        return 0;
    }
};
`;
}
