#include <iostream>
#include <vector>
#include <algorithm>
#include <iomanip>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int m, n;
    if (!(std::cin >> m)) return 0;
    std::vector<long long> nums1(m);
    for (int i = 0; i < m; ++i) std::cin >> nums1[i];

    if (!(std::cin >> n)) return 0;
    std::vector<long long> nums2(n);
    for (int i = 0; i < n; ++i) std::cin >> nums2[i];

    if (m > n) {
        std::swap(nums1, nums2);
        std::swap(m, n);
    }

    int left = 0, right = m;
    int half_len = (m + n + 1) / 2;

    double median = 0.0;
    while (left <= right) {
        int i = left + (right - left) / 2;
        int j = half_len - i;

        long long max_left_1 = (i == 0) ? -1e18 : nums1[i - 1];
        long long min_right_1 = (i == m) ? 1e18 : nums1[i];

        long long max_left_2 = (j == 0) ? -1e18 : nums2[j - 1];
        long long min_right_2 = (j == n) ? 1e18 : nums2[j];

        if (max_left_1 <= min_right_2 && max_left_2 <= min_right_1) {
            if ((m + n) % 2 == 1) {
                median = static_cast<double>(std::max(max_left_1, max_left_2));
            } else {
                long long max_left = std::max(max_left_1, max_left_2);
                long long min_right = std::min(min_right_1, min_right_2);
                median = (max_left + min_right) / 2.0;
            }
            break;
        } else if (max_left_1 > min_right_2) {
            right = i - 1;
        } else {
            left = i + 1;
        }
    }

    std::cout << std::fixed << std::setprecision(5) << median << "\n";
    return 0;
}
