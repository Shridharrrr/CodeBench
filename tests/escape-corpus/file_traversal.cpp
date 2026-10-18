// Escape Corpus: Host Filesystem Traversal Probe
// Intended verdict: RE / WA (fails to read any sensitive host file due to pivot_root tmpfs and Landlock)
#include <fstream>
#include <iostream>
#include <string>

int main() {
    const char* targets[] = {
        "/etc/shadow",
        "/etc/passwd",
        "/proc/1/cmdline",
        "/proc/self/cgroup",
        "/sys/fs/cgroup",
        "../../../../../../etc/passwd"
    };

    bool breach = false;
    for (const char* target : targets) {
        std::ifstream file(target);
        if (file.is_open()) {
            std::string line;
            if (std::getline(file, line) && !line.empty()) {
                breach = true;
                std::cout << "BREACH: Read " << target << ": " << line << "\n";
            }
        }
    }

    if (breach) {
        return 1; // Exit with error if breach occurred
    }

    std::cout << "SECURE: All host traversal targets blocked.\n";
    return 0;
}
