#include <iostream>
#include <vector>
#include <string>
#include <thread>
#include <chrono>

// TLE solution: sleeps on large Q
int main() {
    int capacity, q;
    if (!(std::cin >> capacity >> q)) return 0;
    if (q >= 10000) {
        std::this_thread::sleep_for(std::chrono::milliseconds(3000));
    }
    for (int i = 0; i < q; ++i) {
        std::string op;
        std::cin >> op;
        if (op == "get") {
            long long k;
            std::cin >> k;
            std::cout << 0 << "\n";
        } else if (op == "put") {
            long long k, v;
            std::cin >> k >> v;
        }
    }
    return 0;
}
