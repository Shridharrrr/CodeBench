#include <iostream>
#include <string>
#include <unordered_map>
#include <list>

class LRUCache {
private:
    int capacity;
    std::list<std::pair<long long, long long>> items;
    std::unordered_map<long long, std::list<std::pair<long long, long long>>::iterator> cache;

public:
    LRUCache(int cap) : capacity(cap) {}

    long long get(long long key) {
        auto it = cache.find(key);
        if (it == cache.end()) {
            return -1;
        }
        items.splice(items.begin(), items, it->second);
        return it->second->second;
    }

    void put(long long key, long long value) {
        auto it = cache.find(key);
        if (it != cache.end()) {
            items.splice(items.begin(), items, it->second);
            it->second->second = value;
            return;
        }

        if (static_cast<int>(cache.size()) == capacity) {
            auto last = items.back();
            cache.erase(last.first);
            items.pop_back();
        }

        items.emplace_front(key, value);
        cache[key] = items.begin();
    }
};

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int capacity, q;
    if (!(std::cin >> capacity >> q)) return 0;

    LRUCache lru(capacity);

    for (int i = 0; i < q; ++i) {
        std::string op;
        std::cin >> op;
        if (op == "get") {
            long long key;
            std::cin >> key;
            std::cout << lru.get(key) << "\n";
        } else if (op == "put") {
            long long key, val;
            std::cin >> key >> val;
            lru.put(key, val);
        }
    }

    return 0;
}
