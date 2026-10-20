#include <iostream>
#include <string>
#include <thread>
#include <chrono>

// TLE solution: sleep on large strings
int main() {
    std::string s;
    if (!(std::cin >> s)) return 0;
    if (s.size() >= 1000) {
        std::this_thread::sleep_for(std::chrono::milliseconds(3000));
    }
    std::cout << s.substr(0, 1) << "\n";
    return 0;
}
