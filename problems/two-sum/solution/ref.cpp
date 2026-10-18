#include <iostream>
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
    std::cout << ans_i << " " << ans_j << "\n";
    return 0;
}
