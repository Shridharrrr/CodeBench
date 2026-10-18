// Escape Corpus: Stack Overflow Exhaustion
// Intended verdict: RE (SIGSEGV upon hitting stack limit RLIMIT_STACK)
#include <iostream>

void recurse(int depth) {
    volatile char buffer[1024 * 64]; // 64 KB frame
    buffer[0] = depth;
    recurse(depth + 1);
}

int main() {
    recurse(0);
    return 0;
}
