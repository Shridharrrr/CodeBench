#include <iostream>
#include <string>
#include <thread>
#include <chrono>

// TLE solution: sleep on large word list
int main() {
    std::string b, e;
    int n;
    if (std::cin >> b >> e >> n) {
        if (n >= 1000) {
            std::this_thread::sleep_for(std::chrono::milliseconds(3000));
        }
    }
    std::cout << 0 << "\n";
    return 0;
}
