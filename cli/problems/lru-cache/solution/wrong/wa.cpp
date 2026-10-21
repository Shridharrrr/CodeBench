#include <iostream>
#include <string>

// Wrong answer: always outputs -1 for get operations
int main() {
    int capacity, q;
    if (!(std::cin >> capacity >> q)) return 0;
    for (int i = 0; i < q; ++i) {
        std::string op;
        std::cin >> op;
        if (op == "get") {
            long long k;
            std::cin >> k;
            std::cout << -1 << "\n";
        } else if (op == "put") {
            long long k, v;
            std::cin >> k >> v;
        }
    }
    return 0;
}
