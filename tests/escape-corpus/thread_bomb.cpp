// Escape Corpus: Thread Explosion Bomb
// Intended verdict: RE (fails when thread creation exceeds pids.max / RLIMIT_NPROC)
#include <thread>
#include <vector>
#include <chrono>

void worker() {
    std::this_thread::sleep_for(std::chrono::seconds(10));
}

int main() {
    std::vector<std::thread> threads;
    while (true) {
        threads.emplace_back(worker);
    }
    return 0;
}
