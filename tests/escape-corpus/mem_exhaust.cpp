// Escape Corpus: Memory Exhaustion (OOM)
// Intended verdict: MLE (killed by cgroup memory.max and swap.max = 0)
#include <vector>
#include <cstdlib>

int main() {
    std::vector<void*> allocations;
    // Attempt to allocate 8 GB of memory in 64MB chunks
    for (int i = 0; i < 128; ++i) {
        void* ptr = std::malloc(64 * 1024 * 1024);
        if (ptr) {
            // Touch memory so pages are actually faulted into RAM
            char* c = static_cast<char*>(ptr);
            for (int j = 0; j < 64 * 1024 * 1024; j += 4096) {
                c[j] = 1;
            }
            allocations.push_back(ptr);
        }
    }
    return 0;
}
