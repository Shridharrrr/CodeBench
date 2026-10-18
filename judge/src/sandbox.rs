use anyhow::Result;
use tracing::info;

#[derive(Debug, Clone)]
pub struct HostCapabilities {
    pub cgroup_v2: bool,
    pub user_namespaces: bool,
    pub seccomp: bool,
    pub landlock: bool,
    pub perf_events: bool,
    pub timing_grade: String,
}

pub struct CapabilityProbe;

impl CapabilityProbe {
    pub fn probe() -> HostCapabilities {
        #[cfg(target_os = "linux")]
        {
            let cgroup_v2 = std::path::Path::new("/sys/fs/cgroup/cgroup.controllers").exists();
            let user_ns = std::path::Path::new("/proc/sys/kernel/unprivileged_userns_clone").exists()
                || std::path::Path::new("/proc/self/ns/user").exists();

            let timing_grade = if cgroup_v2 && user_ns {
                "Grade B (Linux Standard Scheduling)".to_string()
            } else {
                "Grade C (Containerized / Virtualized)".to_string()
            };

            HostCapabilities {
                cgroup_v2,
                user_namespaces: user_ns,
                seccomp: true,
                landlock: true,
                perf_events: true,
                timing_grade,
            }
        }

        #[cfg(not(target_os = "linux"))]
        {
            HostCapabilities {
                cgroup_v2: false,
                user_namespaces: false,
                seccomp: false,
                landlock: false,
                perf_events: false,
                timing_grade: "Grade C (Non-Linux Host / Docker Desktop)".to_string(),
            }
        }
    }
}

pub trait Sandbox {
    fn initialize(&mut self) -> Result<()>;
    fn cleanup(&mut self) -> Result<()>;
}

pub struct StubSandbox;

impl Sandbox for StubSandbox {
    fn initialize(&mut self) -> Result<()> {
        info!("Initialized Stub Sandbox runner");
        Ok(())
    }

    fn cleanup(&mut self) -> Result<()> {
        info!("Cleaned up Stub Sandbox runner");
        Ok(())
    }
}
