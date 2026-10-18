// Escape Corpus: Infinite Busy Loop
// Intended verdict: TLE (killed when cgroup CPU time exceeds limit)
int main() {
    volatile unsigned long long count = 0;
    while (true) {
        count++;
    }
    return 0;
}
