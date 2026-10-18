// Escape Corpus: Output Flooding
// Intended verdict: OLE (Output Limit Exceeded capped at descriptor / memfd limit)
#include <iostream>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    // Flood gigabytes of text to stdout
    while (true) {
        std::cout << "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n";
    }
    return 0;
}
