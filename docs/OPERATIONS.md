# CodeBench Operations Guide

This guide covers running, monitoring, and maintaining CodeBench for competitions and local events.

---

## 1. Deployment Options

CodeBench can be run in two primary ways:

### Single-Host Local Venue (Recommended for Offline Contests)
Run the entire platform on a single host computer connected to a local router or switch. Contestants connect their laptops over local Wi-Fi or Ethernet.

```
       [ Local Wi-Fi Router or Ethernet Switch (No Internet Needed) ]
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [ Participant 1 ]         [ Participant 2 ]         [ Projector / Screen ]
http://192.168.1.100:8080 http://192.168.1.100:8080 http://192.168.1.100:8080/scoreboard
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                      ┌──────────────────────────────┐
                      │    Host Laptop or Server     │
                      │  • API & Web App (Port 8080) │
                      │  • PostgreSQL Database       │
                      │  • Sandbox Judge Runner      │
                      └──────────────────────────────┘
```

### Multi-Node Server Setup
For larger multi-room events or campus networks, the API and database can run on a central server with one or more dedicated Linux judge workers connected over NATS.

---

## 2. Hosting an Offline Contest

### Step 1: Start the Platform

**On Windows:**
```powershell
.\codebench.ps1 host
```

**On Linux or macOS:**
```bash
./codebench host
```

The script will:
1. Run preflight checks (Docker and port availability).
2. Detect your local Wi-Fi / Ethernet IPv4 address.
3. Automatically allow port 8080 through Windows Firewall if prompted.
4. Launch the Docker containers (`codebench-api`, `codebench-postgres`, `codebench-judge`).
5. Print the link you can share with competitors (e.g. `http://192.168.1.100:8080`).

### Step 2: Set Up the Venue
1. Open `http://<YOUR_IP>:8080/scoreboard` on a projector or external display.
2. Tell contestants to connect to the venue Wi-Fi and open `http://<YOUR_IP>:8080` in their browser.
3. Log in with the default admin account:
   - **Email:** `admin@codebench.local`
   - **Password:** `codebench123`
4. From the **Admin Dashboard**, pick problems for the contest and click **Start Contest**.

### Step 3: During the Contest
- Contestants solve problems in the Arena tab. Their draft code and selected problems are saved in their browser, so reloading the page won't wipe their work.
- The live scoreboard automatically refreshes whenever any contestant receives a verdict.
- If you need to freeze the scoreboard before the contest ends, open **Admin Dashboard** and set a freeze time or click **Freeze Scoreboard**.

### Step 4: After the Contest
- To reveal the final scores, click **Unfreeze Scoreboard** in the Admin Dashboard.
- When finished, run `.\codebench.ps1 down` (or `./codebench down`) to stop the containers.

---

## 3. Preflight Diagnostics (Doctor)

Before an event, run the doctor check to ensure everything is ready:

```bash
# Windows
.\codebench.ps1 doctor

# Linux / macOS
./codebench doctor
```

The check verifies:
- Docker is installed and running.
- Docker Compose is available.
- Ports `8080`, `5432`, and `4222` are open and available.
- System timing quality (bare-metal Linux provides standard Grade A timing; Windows/macOS with Docker Desktop runs in Grade C VM mode with timing calibration).

---

## 4. Health Checks & Monitoring

### Health Endpoint
Check if the service is healthy:
```bash
curl http://localhost:8080/healthz
# Returns: {"status":"ok"}
```

### Prometheus Metrics
Metrics are available at `GET /metrics` for tracking:
- Total submissions by language and verdict (`codebench_submissions_total`)
- Active real-time connections (`codebench_active_sse_clients`)
- Execution time distributions

---

## 5. Backups and Restores

To take a snapshot of the database, problem packages, and submissions:

```bash
# Create a backup
codebench backup --out ./contest-backup.cbk

# Verify a backup file
codebench backup --verify ./contest-backup.cbk

# Restore from a backup
codebench restore --archive ./contest-backup.cbk --db "postgres://codebench:secret@localhost:5432/codebench"
```

---

## 6. Submissions & Code Execution

- Contestants submit function solutions (e.g. `class Solution { public: ... }`).
- CodeBench injects a test harness around the user's code to feed test case inputs and read outputs.
- Submissions run inside isolated Linux containers with memory ceilings, execution time limits, and restricted system calls.
- If a submission already contains a `main()` function, CodeBench detects it and runs it directly without modification.

---

## 7. Troubleshooting Common Issues

### Contestants cannot connect to `http://<IP>:8080`
1. Check that both the host and contestants are on the exact same Wi-Fi network (not Guest Wi-Fi with client isolation).
2. Check Windows Firewall: ensure TCP port 8080 is allowed for inbound traffic, or temporarily allow it in Windows Security settings.
3. Verify your IP address didn't change (e.g. if the router assigned a new DHCP address, check `ipconfig` or rerun `.\codebench.ps1 host`).

### Submissions show "Pending" or take long to judge
1. Check container status: `docker compose ps`.
2. Check judge logs: `docker compose logs judge`.
3. If running on a laptop on battery power, plug it into power so the CPU does not throttle.
