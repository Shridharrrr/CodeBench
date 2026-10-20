#include <iostream>
#include <string>
#include <vector>
#include <unordered_set>
#include <queue>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string begin_word, end_word;
    if (!(std::cin >> begin_word >> end_word)) return 0;

    int n;
    if (!(std::cin >> n)) return 0;

    std::unordered_set<std::string> word_set;
    for (int i = 0; i < n; ++i) {
        std::string w;
        std::cin >> w;
        word_set.insert(w);
    }

    if (!word_set.contains(end_word)) {
        std::cout << 0 << "\n";
        return 0;
    }

    std::queue<std::pair<std::string, int>> q;
    q.emplace(begin_word, 1);
    word_set.erase(begin_word);

    while (!q.empty()) {
        auto [word, length] = q.front();
        q.pop();

        if (word == end_word) {
            std::cout << length << "\n";
            return 0;
        }

        for (int i = 0; i < static_cast<int>(word.size()); ++i) {
            char original = word[i];
            for (char c = 'a'; c <= 'z'; ++c) {
                if (c == original) continue;
                word[i] = c;
                if (word_set.contains(word)) {
                    word_set.erase(word);
                    q.emplace(word, length + 1);
                }
            }
            word[i] = original;
        }
    }

    std::cout << 0 << "\n";
    return 0;
}
