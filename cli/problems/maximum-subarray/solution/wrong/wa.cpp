#include <iostream>
#include <vector>

// Wrong answer: assumes max_sum is at least 0 (fails on all-negative arrays)
int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    long long max_sum = 0;
    long long cur = 0;
    for (int i = 0; i < n; ++i) {
        long long x;
        std::cin >> x;
        cur += x;
        if (cur > max_sum) max_sum = cur;
        if (cur < 0) cur = 0;
    }
    std::cout << max_sum << "\n";
    return 0;
}
