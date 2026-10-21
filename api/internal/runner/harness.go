package runner

import (
	"strings"
)

// WrapWithDriver wraps a LeetCode-style function/class solution into a complete,
// compilable executable translation unit with a standard I/O driver.
// If the user's code already defines main(), it is returned unchanged for compatibility.
func WrapWithDriver(slug, language, userCode string) string {
	trimmed := strings.TrimSpace(userCode)
	if trimmed == "" {
		return userCode
	}

	// If user already wrote a full program with main(), preserve as-is
	if strings.Contains(userCode, "int main(") ||
		strings.Contains(userCode, "int main (") ||
		strings.Contains(userCode, "void main(") ||
		strings.Contains(userCode, "void main (") ||
		strings.Contains(userCode, "func main(") {
		return userCode
	}

	lang := strings.ToLower(language)
	cleanSlug := strings.ToLower(strings.TrimSpace(slug))

	if strings.HasPrefix(lang, "python") || lang == "py" {
		return wrapPythonDriver(cleanSlug, userCode)
	} else if strings.HasPrefix(lang, "go") {
		return wrapGoDriver(cleanSlug, userCode)
	}

	// Default to C++ (cpp23-gcc, cpp23-clang, c23-gcc, c23-clang)
	return wrapCppDriver(cleanSlug, userCode)
}

func wrapCppDriver(slug, userCode string) string {
	var sb strings.Builder

	// 1. Common LeetCode headers and standard definitions
	sb.WriteString(`#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <cmath>
#include <climits>
#include <numeric>
#include <utility>

using namespace std;

// LeetCode definition for singly-linked list.
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

// LeetCode definition for a binary tree node.
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

// ==================== User Solution ====================
`)
	sb.WriteString(userCode)
	sb.WriteString("\n// =====================================================\n\n")

	// 2. Problem-specific driver main()
	driver, ok := cppDrivers[slug]
	if !ok {
		driver = `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    Solution sol;
    (void)sol;
    return 0;
}`
	}

	sb.WriteString(driver)
	sb.WriteString("\n")

	return sb.String()
}

func wrapPythonDriver(slug, userCode string) string {
	var sb strings.Builder
	sb.WriteString(`import sys
from typing import List, Optional

# Definition for singly-linked list.
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

# Definition for a binary tree node.
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

# User Solution
`)
	sb.WriteString(userCode)
	sb.WriteString("\n\n")

	driver, ok := pythonDrivers[slug]
	if !ok {
		driver = `if __name__ == '__main__':
    pass`
	}
	sb.WriteString(driver)
	sb.WriteString("\n")
	return sb.String()
}

func wrapGoDriver(slug, userCode string) string {
	var sb strings.Builder
	if !strings.Contains(userCode, "package ") {
		sb.WriteString("package main\n\n")
	}
	sb.WriteString(`import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type ListNode struct {
	Val  int
	Next *ListNode
}

type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

`)
	sb.WriteString(userCode)
	sb.WriteString("\n\n")

	driver, ok := goDrivers[slug]
	if !ok {
		driver = `func main() {
}`
	}
	sb.WriteString(driver)
	sb.WriteString("\n")
	return sb.String()
}

// C++ Drivers registry for LeetCode problems
var cppDrivers = map[string]string{
	"two-sum": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    long long target;
    if (cin >> n >> target) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        vector<int> ans = sol.twoSum(nums, target);
        if (ans.size() >= 2) {
            cout << ans[0] << " " << ans[1] << "\n";
        }
    }
    return 0;
}`,

	"valid-palindrome": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    if (getline(cin, s)) {
        Solution sol;
        cout << (sol.isPalindrome(s) ? "true" : "false") << "\n";
    }
    return 0;
}`,

	"binary-search": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n, target;
    if (cin >> n >> target) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        cout << sol.search(nums, target) << "\n";
    }
    return 0;
}`,

	"maximum-subarray": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        cout << sol.maxSubArray(nums) << "\n";
    }
    return 0;
}`,

	"longest-palindromic-substring": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    if (cin >> s) {
        Solution sol;
        cout << sol.longestPalindrome(s) << "\n";
    }
    return 0;
}`,

	"merge-intervals": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<vector<int>> intervals(n, vector<int>(2));
        for (int i = 0; i < n; ++i) cin >> intervals[i][0] >> intervals[i][1];
        Solution sol;
        vector<vector<int>> res = sol.merge(intervals);
        for (size_t i = 0; i < res.size(); ++i) {
            cout << res[i][0] << " " << res[i][1] << (i + 1 == res.size() ? "" : " ");
        }
        cout << "\n";
    }
    return 0;
}`,

	"trapping-rain-water": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> height(n);
        for (int i = 0; i < n; ++i) cin >> height[i];
        Solution sol;
        cout << sol.trap(height) << "\n";
    }
    return 0;
}`,

	"median-of-two-sorted-arrays": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n, m;
    if (cin >> n >> m) {
        vector<int> nums1(n), nums2(m);
        for (int i = 0; i < n; ++i) cin >> nums1[i];
        for (int i = 0; i < m; ++i) cin >> nums2[i];
        Solution sol;
        double ans = sol.findMedianSortedArrays(nums1, nums2);
        cout << fixed; cout.precision(5);
        if (ans == (long long)ans) cout << (long long)ans << "\n";
        else cout << ans << "\n";
    }
    return 0;
}`,

	"word-ladder": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string beginWord, endWord;
    int n;
    if (cin >> beginWord >> endWord >> n) {
        vector<string> wordList(n);
        for (int i = 0; i < n; ++i) cin >> wordList[i];
        Solution sol;
        cout << sol.ladderLength(beginWord, endWord, wordList) << "\n";
    }
    return 0;
}`,

	"lru-cache": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int capacity, q;
    if (cin >> capacity >> q) {
        LRUCache cache(capacity);
        while (q--) {
            string op;
            if (!(cin >> op)) break;
            if (op == "get") {
                int key; cin >> key;
                cout << cache.get(key) << "\n";
            } else if (op == "put") {
                int key, val; cin >> key >> val;
                cache.put(key, val);
            }
        }
    }
    return 0;
}`,

	"best-time-to-buy-and-sell-stock": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> prices(n);
        for (int i = 0; i < n; ++i) cin >> prices[i];
        Solution sol;
        cout << sol.maxProfit(prices) << "\n";
    }
    return 0;
}`,

	"contains-duplicate": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        cout << (sol.containsDuplicate(nums) ? "true" : "false") << "\n";
    }
    return 0;
}`,

	"climbing-stairs": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        Solution sol;
        cout << sol.climbStairs(n) << "\n";
    }
    return 0;
}`,

	"valid-parentheses": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    if (cin >> s) {
        Solution sol;
        cout << (sol.isValid(s) ? "true" : "false") << "\n";
    }
    return 0;
}`,

	"single-number": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        cout << sol.singleNumber(nums) << "\n";
    }
    return 0;
}`,

	"3sum": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        vector<vector<int>> res = sol.threeSum(nums);
        for (const auto& r : res) {
            for (size_t i = 0; i < r.size(); ++i) cout << r[i] << (i + 1 == r.size() ? "" : " ");
            cout << "\n";
        }
    }
    return 0;
}`,

	"coin-change": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n, amount;
    if (cin >> n >> amount) {
        vector<int> coins(n);
        for (int i = 0; i < n; ++i) cin >> coins[i];
        Solution sol;
        cout << sol.coinChange(coins, amount) << "\n";
    }
    return 0;
}`,

	"product-of-array-except-self": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) cin >> nums[i];
        Solution sol;
        vector<int> res = sol.productExceptSelf(nums);
        for (size_t i = 0; i < res.size(); ++i) {
            cout << res[i] << (i + 1 == res.size() ? "" : " ");
        }
        cout << "\n";
    }
    return 0;
}`,

	"reverse-linked-list": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (cin >> n) {
        ListNode dummy(0);
        ListNode* tail = &dummy;
        for (int i = 0; i < n; ++i) {
            int v; cin >> v;
            tail->next = new ListNode(v);
            tail = tail->next;
        }
        Solution sol;
        ListNode* res = sol.reverseList(dummy.next);
        while (res) {
            cout << res->val << (res->next ? " " : "");
            res = res->next;
        }
        cout << "\n";
    }
    return 0;
}`,

	"merge-two-sorted-lists": `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n, m;
    if (cin >> n >> m) {
        ListNode d1(0), d2(0);
        ListNode* t1 = &d1;
        ListNode* t2 = &d2;
        for (int i = 0; i < n; ++i) { int v; cin >> v; t1->next = new ListNode(v); t1 = t1->next; }
        for (int i = 0; i < m; ++i) { int v; cin >> v; t2->next = new ListNode(v); t2 = t2->next; }
        Solution sol;
        ListNode* res = sol.mergeTwoLists(d1.next, d2.next);
        while (res) {
            cout << res->val << (res->next ? " " : "");
            res = res->next;
        }
        cout << "\n";
    }
    return 0;
}`,
}

var pythonDrivers = map[string]string{
	"two-sum": `if __name__ == '__main__':
    data = sys.stdin.read().split()
    if len(data) >= 2:
        n, target = int(data[0]), int(data[1])
        nums = [int(x) for x in data[2:2+n]]
        ans = Solution().twoSum(nums, target)
        if len(ans) >= 2:
            print(f"{ans[0]} {ans[1]}")
`,
	"valid-palindrome": `if __name__ == '__main__':
    s = sys.stdin.readline().rstrip('\r\n')
    ans = Solution().isPalindrome(s)
    print("true" if ans else "false")
`,
	"binary-search": `if __name__ == '__main__':
    data = sys.stdin.read().split()
    if len(data) >= 2:
        n, target = int(data[0]), int(data[1])
        nums = [int(x) for x in data[2:2+n]]
        print(Solution().search(nums, target))
`,
	"maximum-subarray": `if __name__ == '__main__':
    data = sys.stdin.read().split()
    if len(data) >= 1:
        n = int(data[0])
        nums = [int(x) for x in data[1:1+n]]
        print(Solution().maxSubArray(nums))
`,
}

var goDrivers = map[string]string{
	"two-sum": `func main() {
	reader := bufio.NewReader(os.Stdin)
	var n int
	var target int
	if _, err := fmt.Fscan(reader, &n, &target); err == nil {
		nums := make([]int, n)
		for i := 0; i < n; i++ {
			fmt.Fscan(reader, &nums[i])
		}
		ans := twoSum(nums, target)
		if len(ans) >= 2 {
			fmt.Printf("%d %d\n", ans[0], ans[1])
		}
	}
}`,
	"binary-search": `func main() {
	reader := bufio.NewReader(os.Stdin)
	var n, target int
	if _, err := fmt.Fscan(reader, &n, &target); err == nil {
		nums := make([]int, n)
		for i := 0; i < n; i++ {
			fmt.Fscan(reader, &nums[i])
		}
		fmt.Println(search(nums, target))
	}
}`,
}
