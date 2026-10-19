#include <iostream>
#include <string>
#include <cctype>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string s;
    if (!std::getline(std::cin, s)) return 0;

    int left = 0;
    int right = static_cast<int>(s.size()) - 1;

    while (left < right) {
        while (left < right && !std::isalnum(static_cast<unsigned char>(s[left]))) {
            left++;
        }
        while (left < right && !std::isalnum(static_cast<unsigned char>(s[right]))) {
            right--;
        }
        if (std::tolower(static_cast<unsigned char>(s[left])) != std::tolower(static_cast<unsigned char>(s[right]))) {
            std::cout << "false\n";
            return 0;
        }
        left++;
        right--;
    }

    std::cout << "true\n";
    return 0;
}
