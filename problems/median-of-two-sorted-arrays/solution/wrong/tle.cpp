#include <iostream>
#include <thread>
#include <chrono>

// TLE solution: sleeps on large M+N
int main() {
    int m, n;
    if (std::cin >> m) {
        if (m >= 10000) {
            std::this_thread::sleep_for(std::chrono::milliseconds(3000));
        }
    }
    std::cout << "0.0\n";
    return 0;
}
