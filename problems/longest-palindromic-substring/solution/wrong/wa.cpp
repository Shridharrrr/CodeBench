#include <iostream>
#include <string>

// Wrong answer: always prints just the first character
int main() {
    std::string s;
    if (std::cin >> s && !s.empty()) {
        std::cout << s[0] << "\n";
    }
    return 0;
}
