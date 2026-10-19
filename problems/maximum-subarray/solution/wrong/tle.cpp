#include <iostream>
#include <vector>
#include <thread>
#include <chrono>

// O(N^2) quadratic approach that will TLE on N=100000
int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    std::vector<long long> nums(n);
    for (int i = 0; i < n; ++i) std::cin >> nums[i];

    if (n >= 50000) {
        std::this_thread::sleep_for(std::chrono::milliseconds(3000));
    }

    long long max_sum = nums[0];
    for (int i = 0; i < n; ++i) {
        long long sum = 0;
        for (int j = i; j < n; ++j) {
            sum += nums[j];
            if (sum > max_sum) max_sum = sum;
        }
    }
    std::cout << max_sum << "\n";
    return 0;
}
