// Escape Corpus: Fork Bomb
// Intended verdict: RE (killed by pids.max limit or seccomp blocking fork/clone)
#include <unistd.h>
#include <sys/types.h>

int main() {
    while (true) {
        fork();
    }
    return 0;
}
