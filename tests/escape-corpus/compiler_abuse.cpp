// Escape Corpus: Compiler Template Bomb & Include Abuse
// Intended verdict: CE (killed by compiler sandbox timeout or memory limit)

// Attempt to read sensitive files via compiler include
#if __has_include("/etc/shadow")
#include "/etc/shadow"
#endif

// Recursive template explosion bomb
template <int N>
struct Factorial {
    enum { val = N * Factorial<N - 1>::val };
};

template <>
struct Factorial<0> {
    enum { val = 1 };
};

int main() {
    volatile int x = Factorial<50000>::val;
    return x;
}
