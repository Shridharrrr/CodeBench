use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelCapabilities {
    pub cgroup_v2: bool,
    pub cgroup_memory: bool,
    pub cgroup_cpu: bool,
    pub cgroup_pids: bool,
    pub cgroup_cpuset: bool,
    pub namespaces_user: bool,
    pub namespaces_mount: bool,
    pub namespaces_pid: bool,
    pub namespaces_net: bool,
    pub namespaces_ipc: bool,
    pub namespaces_uts: bool,
    pub clone3_support: bool,
    pub pidfd_support: bool,
    pub epoll_support: bool,
    pub seccomp_bpf: bool,
    pub landlock_lsm: bool,
    pub perf_event_instructions: bool,
    pub timing_grade: String,
    pub grade_reason: String,
}

pub struct CapabilityProbe;

impl CapabilityProbe {
    pub fn probe() -> KernelCapabilities {
        #[cfg(target_os = "linux")]
        {
            Self::probe_linux()
        }

        #[cfg(not(target_os = "linux"))]
        {
            KernelCapabilities {
                cgroup_v2: false,
                cgroup_memory: false,
                cgroup_cpu: false,
                cgroup_pids: false,
                cgroup_cpuset: false,
                namespaces_user: false,
                namespaces_mount: false,
                namespaces_pid: false,
                namespaces_net: false,
                namespaces_ipc: false,
                namespaces_uts: false,
                clone3_support: false,
                pidfd_support: false,
                epoll_support: false,
                seccomp_bpf: false,
                landlock_lsm: false,
                perf_event_instructions: false,
                timing_grade: "Grade C (Non-Linux Host / Docker Desktop)".to_string(),
                grade_reason: "Running on non-Linux OS (Windows/macOS) with hypervisor virtualization".to_string(),
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn probe_linux() -> KernelCapabilities {
        let controllers_path = Path::new("/sys/fs/cgroup/cgroup.controllers");
        let cgroup_v2 = controllers_path.exists();

        let mut cgroup_memory = false;
        let mut cgroup_cpu = false;
        let mut cgroup_pids = false;
        let mut cgroup_cpuset = false;

        if let Ok(content) = fs::read_to_string(controllers_path) {
            cgroup_memory = content.contains("memory");
            cgroup_cpu = content.contains("cpu");
            cgroup_pids = content.contains("pids");
            cgroup_cpuset = content.contains("cpuset");
        }

        let namespaces_user = Path::new("/proc/sys/kernel/unprivileged_userns_clone").exists()
            || Path::new("/proc/self/ns/user").exists();
        let namespaces_mount = Path::new("/proc/self/ns/mnt").exists();
        let namespaces_pid = Path::new("/proc/self/ns/pid").exists();
        let namespaces_net = Path::new("/proc/self/ns/net").exists();
        let namespaces_ipc = Path::new("/proc/self/ns/ipc").exists();
        let namespaces_uts = Path::new("/proc/self/ns/uts").exists();

        let seccomp_bpf = Path::new("/proc/sys/kernel/seccomp").exists()
            || fs::read_to_string("/proc/sys/kernel/seccomp/actions_avail")
                .map(|s| s.contains("kill_process"))
                .unwrap_or(false);

        let landlock_lsm = fs::read_to_string("/sys/kernel/security/lsm")
            .map(|s| s.contains("landlock"))
            .unwrap_or(false);

        // Check WSL2 / Docker Desktop virtualized environment
        let is_wsl = fs::read_to_string("/proc/version")
            .map(|s| s.to_lowercase().contains("microsoft"))
            .unwrap_or(false);

        let (timing_grade, grade_reason) = if is_wsl {
            (
                "Grade C (WSL2 / Docker Desktop on Windows)".to_string(),
                "Hypervisor timer virtualization adds CPU accounting jitter; suitable for practice and testing."
                    .to_string(),
            )
        } else if cgroup_v2 && cgroup_cpu && cgroup_memory && namespaces_pid {
            // Check if cpuset is tuned
            if Path::new("/sys/devices/system/cpu/isolated").exists() {
                (
                    "Grade A (Tuned Linux Bare-Metal)".to_string(),
                    "Isolated cores, cgroups v2, and direct hardware CPU accounting active.".to_string(),
                )
            } else {
                (
                    "Grade B (Default Linux Scheduling)".to_string(),
                    "Standard Linux CFS scheduling without isolated cores; suitable for casual contests."
                        .to_string(),
                )
            }
        } else {
            (
                "Grade C (Degraded Host Capabilities)".to_string(),
                "Missing one or more required cgroup v2 controllers.".to_string(),
            )
        };

        KernelCapabilities {
            cgroup_v2,
            cgroup_memory,
            cgroup_cpu,
            cgroup_pids,
            cgroup_cpuset,
            namespaces_user,
            namespaces_mount,
            namespaces_pid,
            namespaces_net,
            namespaces_ipc,
            namespaces_uts,
            clone3_support: true,
            pidfd_support: true,
            epoll_support: true,
            seccomp_bpf,
            landlock_lsm,
            perf_event_instructions: true,
            timing_grade,
            grade_reason,
        }
    }
}
