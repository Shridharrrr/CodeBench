// Escape Corpus: Unauthorized Syscall Probe (Network, Ptrace, Reboot)
// Intended verdict: RE (killed immediately with SIGSYS via seccomp filter)
#include <sys/socket.h>
#include <netinet/in.h>
#include <sys/ptrace.h>
#include <unistd.h>
#include <sys/reboot.h>

int main() {
    // 1. Attempt to open a raw network socket
    int sock = socket(AF_INET, SOCK_STREAM, 0);

    // 2. Attempt ptrace
    ptrace(PTRACE_TRACEME, 0, nullptr, nullptr);

    // 3. Attempt reboot syscall
    reboot(RB_AUTOBOOT);

    return 0;
}
