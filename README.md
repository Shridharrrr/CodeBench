# CodeBench

> Host offline coding competitions from a single laptop. Zero internet required.

If you've ever tried running a coding contest on campus Wi-Fi or at a local hackathon, you probably know the pain: conference Wi-Fi cuts out, cloud judging platforms rate-limit you, and participants waste half their time debugging `cin >> n` loops instead of actually solving algorithmic problems.

**CodeBench** solves this by running the entire platform locally on your machine. You plug into a local Wi-Fi router or switch, run one command, and contestants can immediately open your local IP in their browser, write LeetCode-style solutions, and watch live scores roll in.

---

## What's Inside

- **LeetCode-Style Function Submissions**: Participants write clean `class Solution` methods in C++, Python, Go, or Rust. CodeBench automatically wraps the code with an internal test driver that feeds test cases and checks outputs.
- **Single-Host Offline Mode**: Everything (API, PostgreSQL, embedded message queue, and sandbox judge) runs self-contained on one computer. Contestants connect directly over local Wi-Fi or Ethernet.
- **Real-Time Scoreboard**: Standings stream live over Server-Sent Events (SSE). No refreshing needed. Supports end-of-round score freezes to build suspense before the winners are announced.
- **Container Sandboxing**: Untrusted code is isolated using Linux namespaces, cgroups v2 memory & CPU ceilings, and Seccomp system call filtering.
- **Squads & Teams**: Built-in support for team rosters, join passcodes, and combined team scores.
- **60 Built-in Problems**: Ships with 60 problems ranging from Easy to Hard, with support for writing custom problems in plain Markdown.

---

## Quick Start (Hosting an Offline Event)

### 1. Clone the repository
```bash
git clone https://github.com/Shridharrrr/CodeBench.git
cd CodeBench
```

### 2. Start the platform

**On Windows (PowerShell):**
```powershell
.\codebench.ps1 host
```

**On Linux or macOS (Bash):**
```bash
./codebench host
```

The script will:
1. Verify Docker is running.
2. Detect your computer's local Wi-Fi or Ethernet IPv4 address.
3. Automatically allow port 8080 through Windows Firewall if prompted.
4. Start the database, API server, and judge containers.
5. Print the URL you can share with competitors (e.g. `http://192.168.1.100:8080`).

### 3. Run your contest
1. Connect your computer to a venue router or switch (internet is completely optional).
2. Cast `http://<YOUR_IP>:8080/scoreboard` onto a projector or stage display.
3. Have participants connect to the same Wi-Fi and open `http://<YOUR_IP>:8080`.
4. Log into the default admin account:
   - **Email:** `admin@codebench.local`
   - **Password:** `codebench123`
5. From the Admin Dashboard, select problems and click **Start Contest**.

---

## Local Development

If you prefer starting services manually using Docker Compose:

```bash
git clone https://github.com/Shridharrrr/CodeBench.git
cd CodeBench

# Start all containers in the background
docker compose up -d

# Open in browser: http://localhost:8080
```

### Running Frontend & API without Docker

```bash
# Terminal 1: Run the Go API backend
go run ./api/cmd/codebench-api

# Terminal 2: Run the SolidJS frontend dev server
cd web
npm install
npm run dev
```

---

## How Submissions Work

Unlike old-school competitive programming platforms that force students to write input parsers and `int main()`, CodeBench uses standard function solutions:

```cpp
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int complement = target - nums[i];
            if (seen.count(complement)) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};
```

When a participant clicks **Run** or **Submit**:
1. CodeBench wraps their code with a lightweight driver harness for that language.
2. The code is compiled inside an unprivileged sandbox container.
3. The runner streams test cases through standard input pipes directly into the binary.
4. Output is validated against expected test outputs, returning instant verdicts: **Accepted (AC)**, **Wrong Answer (WA)**, **Time Limit Exceeded (TLE)**, or **Compile Error (CE)**.

### Supported Languages

| Language | Toolchain | Invocation |
| :--- | :--- | :--- |
| **C++23** | GCC 14.2 / Clang 18 | `g++ -O2 -std=c++23` |
| **C23** | GCC 14.2 / Clang 18 | `gcc -O2 -std=c23` |
| **Python** | Python 3.12 | Standard Python 3 interpreter |
| **Go** | Go 1.24 | Native `go build` |
| **Rust** | Rust 1.85 | `rustc -O` |

---

## Adding Custom Problems

You can add new problems either as folder packages or as simple Markdown files.

### Option A: Markdown Format (Fastest)

Create a single `.md` file with YAML frontmatter, description, and test blocks:

````markdown
---
slug: two-sum
title: Two Sum
difficulty: Easy
tags: [array, hash-table]
time_limit_ms: 1000
memory_mb: 256
---

# Two Sum

Given an array of integers `nums` and an integer `target`, return indices of the two numbers that add up to `target`.

### Example 1:
**Input:** nums = [2,7,11,15], target = 9  
**Output:** [0,1]

### Constraints:
- `2 <= nums.length <= 10^4`

### Sample Test 1
```input
4 9
2 7 11 15
```
```output
0 1
```
````

Upload it through the Admin Dashboard or drop it into the `problems/` directory.

### Option B: Package Directory Format

For large test suites with dedicated hidden test files:

```
problems/two-sum/
├── problem.yaml          # Limits, tags, and score weights
├── statement.md          # Description and examples
├── solution/
│   └── ref.cpp           # Reference solution
└── tests/
    ├── sample/           # Visible sample test cases (.in / .out)
    └── hidden/           # Hidden judge test cases (.in / .out)
```

---

## Command Line Tool (CLI)

The repository includes a helper CLI for quick testing, backups, and terminal submissions:

```bash
# Check system readiness (Docker, ports, and cgroups v2 timing grade)
./codebench doctor

# Take a full snapshot backup (database and problem packages)
codebench backup --out ./contest-backup.cbk

# Restore from a previous backup
codebench restore --archive ./contest-backup.cbk
```

---

## Keyboard Shortcuts

The web interface includes keyboard navigation for fast switching between views:

| Key | Destination |
| :---: | :--- |
| `1` | Home page |
| `2` | Contest Arena |
| `3` | Squads / Team Management |
| `4` | Live Scoreboard |
| `0` | Interactive Showcase / Demo Page |
| `5` | Admin Dashboard *(Organizers only)* |
| `T` | Toggle Light / Dark theme |
| `C` | Toggle CRT retro scanline overlay |
| `?` | Keyboard shortcut cheat sheet |
| `Esc`| Dismiss dialogs & modals |

---

## Running the Automated Test Suite

```bash
# Run all Go tests
go test ./...

# Build web frontend
cd web && npm run build
```

---

## License

Released under the [Apache 2.0 License](LICENSE).
