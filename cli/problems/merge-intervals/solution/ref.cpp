#include <iostream>
#include <vector>
#include <algorithm>

struct Interval {
    long long start, end;
};

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<Interval> intervals(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> intervals[i].start >> intervals[i].end;
    }

    std::sort(intervals.begin(), intervals.end(), [](const Interval& a, const Interval& b) {
        if (a.start != b.start) return a.start < b.start;
        return a.end < b.end;
    });

    std::vector<Interval> merged;
    for (const auto& iv : intervals) {
        if (merged.empty() || merged.back().end < iv.start) {
            merged.push_back(iv);
        } else {
            merged.back().end = std::max(merged.back().end, iv.end);
        }
    }

    std::cout << merged.size() << "\n";
    for (const auto& iv : merged) {
        std::cout << iv.start << " " << iv.end << "\n";
    }

    return 0;
}
