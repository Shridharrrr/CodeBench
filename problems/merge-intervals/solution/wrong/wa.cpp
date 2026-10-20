#include <iostream>
#include <vector>

// Wrong answer: forgets to sort before merging
int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    std::cout << n << "\n";
    for (int i = 0; i < n; ++i) {
        long long s, e;
        std::cin >> s >> e;
        std::cout << s << " " << e << "\n";
    }
    return 0;
}
