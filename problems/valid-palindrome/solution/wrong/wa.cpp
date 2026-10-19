#include <iostream>
#include <string>

// Deliberately wrong solution: does not ignore non-alphanumeric or case differences
int main() {
    std::string s;
    if (!std::getline(std::cin, s)) return 0;
    std::cout << "false\n";
    return 0;
}
