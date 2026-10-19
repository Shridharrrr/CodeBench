export const DEFAULT_TEMPLATES: Record<string, { cpp: string; c: string }> = {
  'two-sum': {
    cpp: `#include <iostream>
#include <vector>
#include <unordered_map>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    long long target;
    if (!(std::cin >> n >> target)) return 0;

    std::vector<long long> nums(n);
    std::unordered_map<long long, int> seen;
    int ans_i = -1, ans_j = -1;

    for (int i = 0; i < n; ++i) {
        std::cin >> nums[i];
        long long complement = target - nums[i];
        if (ans_i == -1 && seen.contains(complement)) {
            ans_i = seen[complement];
            ans_j = i;
        }
        seen[nums[i]] = i;
    }

    if (ans_i > ans_j) std::swap(ans_i, ans_j);
    std::cout << ans_i << " " << ans_j << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n;
    long long target;
    if (scanf("%d %lld", &n, &target) != 2) return 0;

    long long *nums = (long long *)malloc(sizeof(long long) * n);
    for (int i = 0; i < n; ++i) {
        scanf("%lld", &nums[i]);
    }

    int ans_i = -1, ans_j = -1;
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            if (nums[i] + nums[j] == target) {
                ans_i = i;
                ans_j = j;
                break;
            }
        }
        if (ans_i != -1) break;
    }

    printf("%d %d\\n", ans_i, ans_j);
    free(nums);
    return 0;
}
`,
  },

  'valid-palindrome': {
    cpp: `#include <iostream>
#include <string>
#include <cctype>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string s;
    if (!std::getline(std::cin, s)) return 0;

    int left = 0;
    int right = static_cast<int>(s.length()) - 1;
    bool is_palindrome = true;

    while (left < right) {
        while (left < right && !std::isalnum(static_cast<unsigned char>(s[left]))) left++;
        while (left < right && !std::isalnum(static_cast<unsigned char>(s[right]))) right--;

        if (std::tolower(static_cast<unsigned char>(s[left])) != std::tolower(static_cast<unsigned char>(s[right]))) {
            is_palindrome = false;
            break;
        }
        left++;
        right--;
    }

    std::cout << (is_palindrome ? "true" : "false") << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

int main() {
    char s[200005];
    if (!fgets(s, sizeof(s), stdin)) return 0;

    int left = 0;
    int right = strlen(s) - 1;
    while (right >= 0 && (s[right] == '\\n' || s[right] == '\\r')) right--;

    bool is_pal = true;
    while (left < right) {
        while (left < right && !isalnum((unsigned char)s[left])) left++;
        while (left < right && !isalnum((unsigned char)s[right])) right--;
        if (tolower((unsigned char)s[left]) != tolower((unsigned char)s[right])) {
            is_pal = false;
            break;
        }
        left++;
        right--;
    }

    printf("%s\\n", is_pal ? "true" : "false");
    return 0;
}
`,
  },

  'binary-search': {
    cpp: `#include <iostream>
#include <vector>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    long long target;
    if (!(std::cin >> n >> target)) return 0;

    std::vector<long long> nums(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> nums[i];
    }

    int left = 0, right = n - 1, ans = -1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) {
            ans = mid;
            break;
        } else if (nums[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    std::cout << ans << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n;
    long long target;
    if (scanf("%d %lld", &n, &target) != 2) return 0;

    long long *nums = (long long *)malloc(sizeof(long long) * n);
    for (int i = 0; i < n; ++i) scanf("%lld", &nums[i]);

    int left = 0, right = n - 1, ans = -1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) {
            ans = mid;
            break;
        } else if (nums[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    printf("%d\\n", ans);
    free(nums);
    return 0;
}
`,
  },

  'maximum-subarray': {
    cpp: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    if (!(std::cin >> n) || n <= 0) return 0;

    long long max_sum = -1e18, current_sum = 0;
    for (int i = 0; i < n; ++i) {
        long long val;
        std::cin >> val;
        current_sum = std::max(val, current_sum + val);
        max_sum = std::max(max_sum, current_sum);
    }

    std::cout << max_sum << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) return 0;

    long long max_sum = -1000000000000000000LL;
    long long cur_sum = 0;

    for (int i = 0; i < n; ++i) {
        long long val;
        scanf("%lld", &val);
        if (i == 0 || cur_sum + val < val) {
            cur_sum = val;
        } else {
            cur_sum += val;
        }
        if (cur_sum > max_sum) {
            max_sum = cur_sum;
        }
    }

    printf("%lld\\n", max_sum);
    return 0;
}
`,
  },

  'merge-intervals': {
    cpp: `#include <iostream>
#include <vector>
#include <algorithm>

struct Interval {
    long long start, end;
};

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<Interval> intervals(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> intervals[i].start >> intervals[i].end;
    }

    std::sort(intervals.begin(), intervals.end(), [](const Interval& a, const Interval& b) {
        if (a.start != b.start) return a.start < b.start;
        return a.end < b.end;
    });

    std::vector<Interval> merged;
    for (const auto& cur : intervals) {
        if (merged.empty() || merged.back().end < cur.start) {
            merged.push_back(cur);
        } else {
            merged.back().end = std::max(merged.back().end, cur.end);
        }
    }

    std::cout << merged.size() << "\\n";
    for (const auto& iv : merged) {
        std::cout << iv.start << " " << iv.end << "\\n";
    }
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>

typedef struct {
    long long start, end;
} Interval;

int cmp(const void *a, const void *b) {
    const Interval *ia = (const Interval *)a;
    const Interval *ib = (const Interval *)b;
    if (ia->start != ib->start) return (ia->start < ib->start) ? -1 : 1;
    return (ia->end < ib->end) ? -1 : (ia->end > ib->end ? 1 : 0);
}

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;

    Interval *arr = (Interval *)malloc(sizeof(Interval) * n);
    for (int i = 0; i < n; ++i) scanf("%lld %lld", &arr[i].start, &arr[i].end);

    qsort(arr, n, sizeof(Interval), cmp);

    Interval *merged = (Interval *)malloc(sizeof(Interval) * n);
    int m_count = 0;

    for (int i = 0; i < n; ++i) {
        if (m_count == 0 || merged[m_count - 1].end < arr[i].start) {
            merged[m_count++] = arr[i];
        } else {
            if (arr[i].end > merged[m_count - 1].end) {
                merged[m_count - 1].end = arr[i].end;
            }
        }
    }

    printf("%d\\n", m_count);
    for (int i = 0; i < m_count; ++i) {
        printf("%lld %lld\\n", merged[i].start, merged[i].end);
    }

    free(arr);
    free(merged);
    return 0;
}
`,
  },

  'lru-cache': {
    cpp: `#include <iostream>
#include <string>
#include <list>
#include <unordered_map>

class LRUCache {
    int capacity;
    std::list<std::pair<int, int>> items;
    std::unordered_map<int, std::list<std::pair<int, int>>::iterator> map;

public:
    explicit LRUCache(int cap) : capacity(cap) {}

    int get(int key) {
        auto it = map.find(key);
        if (it == map.end()) return -1;
        items.splice(items.begin(), items, it->second);
        return it->second->second;
    }

    void put(int key, int value) {
        auto it = map.find(key);
        if (it != map.end()) {
            it->second->second = value;
            items.splice(items.begin(), items, it->second);
            return;
        }
        if (static_cast<int>(items.size()) >= capacity) {
            int d_key = items.back().first;
            items.pop_back();
            map.erase(d_key);
        }
        items.emplace_front(key, value);
        map[key] = items.begin();
    }
};

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int cap, q;
    if (!(std::cin >> cap >> q)) return 0;

    LRUCache cache(cap);
    for (int i = 0; i < q; ++i) {
        std::string op;
        std::cin >> op;
        if (op == "get") {
            int key;
            std::cin >> key;
            std::cout << cache.get(key) << "\\n";
        } else if (op == "put") {
            int key, val;
            std::cin >> key >> val;
            cache.put(key, val);
        }
    }
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Simple hash map + doubly linked list for LRU in C
int main() {
    int cap, q;
    if (scanf("%d %d", &cap, &q) != 2) return 0;
    // Enter implementation
    return 0;
}
`,
  },

  'longest-palindromic-substring': {
    cpp: `#include <iostream>
#include <string>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string s;
    if (!(std::cin >> s)) return 0;

    int n = s.length();
    if (n <= 1) {
        std::cout << s << "\\n";
        return 0;
    }

    int start = 0, max_len = 1;
    auto expand = [&](int l, int r) {
        while (l >= 0 && r < n && s[l] == s[r]) {
            int len = r - l + 1;
            if (len > max_len) {
                max_len = len;
                start = l;
            }
            l--;
            r++;
        }
    };

    for (int i = 0; i < n; ++i) {
        expand(i, i);
        expand(i, i + 1);
    }

    std::cout << s.substr(start, max_len) << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <string.h>

int main() {
    char s[2005];
    if (scanf("%2000s", s) != 1) return 0;
    int n = strlen(s);
    if (n <= 1) {
        printf("%s\\n", s);
        return 0;
    }

    int start = 0, max_len = 1;
    for (int i = 0; i < n; ++i) {
        for (int k = 0; k < 2; ++k) {
            int l = i, r = i + k;
            while (l >= 0 && r < n && s[l] == s[r]) {
                int len = r - l + 1;
                if (len > max_len) {
                    max_len = len;
                    start = l;
                }
                l--;
                r++;
            }
        }
    }

    s[start + max_len] = '\\0';
    printf("%s\\n", s + start);
    return 0;
}
`,
  },

  'trapping-rain-water': {
    cpp: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    if (!(std::cin >> n) || n <= 0) {
        std::cout << 0 << "\\n";
        return 0;
    }

    std::vector<int> h(n);
    for (int i = 0; i < n; ++i) std::cin >> h[i];

    int left = 0, right = n - 1;
    int left_max = 0, right_max = 0;
    long long total_water = 0;

    while (left < right) {
        if (h[left] < h[right]) {
            if (h[left] >= left_max) {
                left_max = h[left];
            } else {
                total_water += (left_max - h[left]);
            }
            left++;
        } else {
            if (h[right] >= right_max) {
                right_max = h[right];
            } else {
                total_water += (right_max - h[right]);
            }
            right--;
        }
    }

    std::cout << total_water << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) {
        printf("0\\n");
        return 0;
    }

    int *h = (int *)malloc(sizeof(int) * n);
    for (int i = 0; i < n; ++i) scanf("%d", &h[i]);

    int left = 0, right = n - 1;
    int left_max = 0, right_max = 0;
    long long total_water = 0;

    while (left < right) {
        if (h[left] < h[right]) {
            if (h[left] >= left_max) left_max = h[left];
            else total_water += (left_max - h[left]);
            left++;
        } else {
            if (h[right] >= right_max) right_max = h[right];
            else total_water += (right_max - h[right]);
            right--;
        }
    }

    printf("%lld\\n", total_water);
    free(h);
    return 0;
}
`,
  },

  'median-of-two-sorted-arrays': {
    cpp: `#include <iostream>
#include <vector>
#include <algorithm>
#include <iomanip>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n, m;
    if (!(std::cin >> n >> m)) return 0;

    std::vector<long long> A(n), B(m);
    for (int i = 0; i < n; ++i) std::cin >> A[i];
    for (int i = 0; i < m; ++i) std::cin >> B[i];

    if (n > m) {
        std::swap(A, B);
        std::swap(n, m);
    }

    int low = 0, high = n;
    int half_len = (n + m + 1) / 2;
    double median = 0.0;

    while (low <= high) {
        int i = low + (high - low) / 2;
        int j = half_len - i;

        long long left_a = (i == 0) ? -1e18 : A[i - 1];
        long long right_a = (i == n) ? 1e18 : A[i];
        long long left_b = (j == 0) ? -1e18 : B[j - 1];
        long long right_b = (j == m) ? 1e18 : B[j];

        if (left_a <= right_b && left_b <= right_a) {
            if ((n + m) % 2 == 1) {
                median = std::max(left_a, left_b);
            } else {
                median = (std::max(left_a, left_b) + std::min(right_a, right_b)) / 2.0;
            }
            break;
        } else if (left_a > right_b) {
            high = i - 1;
        } else {
            low = i + 1;
        }
    }

    std::cout << std::fixed << std::setprecision(5) << median << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n, m;
    if (scanf("%d %d", &n, &m) != 2) return 0;
    // Enter implementation
    return 0;
}
`,
  },

  'word-ladder': {
    cpp: `#include <iostream>
#include <string>
#include <vector>
#include <unordered_set>
#include <queue>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string begin_word, end_word;
    int n;
    if (!(std::cin >> begin_word >> end_word >> n)) return 0;

    std::unordered_set<std::string> dict;
    for (int i = 0; i < n; ++i) {
        std::string w;
        std::cin >> w;
        dict.insert(w);
    }

    if (!dict.contains(end_word)) {
        std::cout << 0 << "\\n";
        return 0;
    }

    std::queue<std::pair<std::string, int>> q;
    q.emplace(begin_word, 1);
    std::unordered_set<std::string> visited;
    visited.insert(begin_word);

    int ans = 0;
    while (!q.empty()) {
        auto [word, depth] = q.front();
        q.pop();

        if (word == end_word) {
            ans = depth;
            break;
        }

        std::string temp = word;
        for (int i = 0; i < static_cast<int>(temp.length()); ++i) {
            char orig = temp[i];
            for (char c = 'a'; c <= 'z'; ++c) {
                if (c == orig) continue;
                temp[i] = c;
                if (dict.contains(temp) && !visited.contains(temp)) {
                    visited.insert(temp);
                    q.emplace(temp, depth + 1);
                }
            }
            temp[i] = orig;
        }
    }

    std::cout << ans << "\\n";
    return 0;
}
`,
    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    char begin_w[20], end_w[20];
    int n;
    if (scanf("%s %s %d", begin_w, end_w, &n) != 3) return 0;
    // Enter implementation
    return 0;
}
`,
  },
};

export function getBoilerplate(slug: string, language: string): string {
  const isC = language.startsWith('c23');
  const tpl = DEFAULT_TEMPLATES[slug];
  if (tpl) {
    return isC ? tpl.c : tpl.cpp;
  }
  return isC
    ? `#include <stdio.h>\n\nint main() {\n    printf("Hello Codebench\\n");\n    return 0;\n}\n`
    : `#include <iostream>\n\nint main() {\n    std::cout << "Hello Codebench\\n";\n    return 0;\n}\n`;
}
