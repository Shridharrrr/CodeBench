// TLE Solution: Naive quadratic brute force
#include <iostream>
#include <vector>

int main() {
    int n;
    long long target;
    if (!(std::cin >> n >> target)) return 0;

    std::vector<long long> nums(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> nums[i];
    }

    // Naive O(N^2) search
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            if (nums[i] + nums[j] == target) {
                std::cout << i << " " << j << "\n";
                return 0;
            }
        }
    }
    return 0;
}
