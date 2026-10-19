#include <iostream>
#include <vector>
#include <thread>
#include <chrono>

// Deliberately slow linear scan that times out
int main() {
    int n;
    long long target;
    if (!(std::cin >> n >> target)) return 0;

    std::vector<long long> nums(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> nums[i];
    }

    if (n >= 100000) {
        std::this_thread::sleep_for(std::chrono::milliseconds(3000));
    }

    int ans = -1;
    for (int i = 0; i < n; ++i) {
        if (nums[i] == target) {
            ans = i;
            break;
        }
    }
    std::cout << ans << "\n";
    return 0;
}
