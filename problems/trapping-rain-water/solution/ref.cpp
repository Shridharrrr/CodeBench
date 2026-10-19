#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<long long> height(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> height[i];
    }

    if (n <= 2) {
        std::cout << 0 << "\n";
        return 0;
    }

    int left = 0;
    int right = n - 1;
    long long left_max = 0;
    long long right_max = 0;
    long long trapped = 0;

    while (left < right) {
        if (height[left] <= height[right]) {
            if (height[left] >= left_max) {
                left_max = height[left];
            } else {
                trapped += left_max - height[left];
            }
            left++;
        } else {
            if (height[right] >= right_max) {
                right_max = height[right];
            } else {
                trapped += right_max - height[right];
            }
            right--;
        }
    }

    std::cout << trapped << "\n";
    return 0;
}
