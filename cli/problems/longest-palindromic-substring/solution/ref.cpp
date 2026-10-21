#include <iostream>
#include <string>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string s;
    if (!(std::cin >> s)) return 0;

    int n = static_cast<int>(s.size());
    if (n <= 1) {
        std::cout << s << "\n";
        return 0;
    }

    int start = 0;
    int max_len = 1;

    auto expand = [&](int l, int r) {
        while (l >= 0 && r < n && s[l] == s[r]) {
            l--;
            r++;
        }
        int len = r - l - 1;
        if (len > max_len) {
            max_len = len;
            start = l + 1;
        }
    };

    for (int i = 0; i < n; ++i) {
        expand(i, i);
        expand(i, i + 1);
    }

    std::cout << s.substr(start, max_len) << "\n";
    return 0;
}
