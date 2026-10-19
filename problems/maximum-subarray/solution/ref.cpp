#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<long long> nums(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> nums[i];
    }

    long long current_sum = nums[0];
    long long max_sum = nums[0];

    for (int i = 1; i < n; ++i) {
        current_sum = std::max(nums[i], current_sum + nums[i]);
        max_sum = std::max(max_sum, current_sum);
    }

    std::cout << max_sum << "\n";
    return 0;
}
