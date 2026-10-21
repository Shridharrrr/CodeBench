#include <iostream>
#include <vector>
#include <thread>
#include <chrono>

// TLE solution: sleep on large N
int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    if (n >= 10000) {
        std::this_thread::sleep_for(std::chrono::milliseconds(3000));
    }
    std::cout << 0 << "\n";
    return 0;
}
