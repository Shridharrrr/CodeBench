use anyhow::Result;
#[cfg(target_os = "linux")]
use anyhow::Context;
#[cfg(target_os = "linux")]
use std::fs;
use std::path::{Path, PathBuf};

pub struct CgroupV2Slot {
    pub slot_id: usize,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Default)]
pub struct CgroupStats {
    pub cpu_time_us: u64,
    pub peak_memory_bytes: u64,
}

impl CgroupV2Slot {
    pub fn new(slot_id: usize, base_dir: &Path) -> Result<Self> {
        let path = base_dir.join(format!("codebench-slot-{}", slot_id));
        Ok(Self { slot_id, path })
    }

    /// Setup the cgroup directory and enable controllers
    pub fn initialize(&self, _core_id: Option<usize>) -> Result<()> {
        #[cfg(target_os = "linux")]
        {
            if !self.path.exists() {
                fs::create_dir_all(&self.path)
                    .with_context(|| format!("Failed to create cgroup dir: {:?}", self.path))?;
            }

            // Pin to core if specified
            if let Some(core) = _core_id {
                let cpuset_file = self.path.join("cpuset.cpus");
                if cpuset_file.exists() {
                    let _ = fs::write(cpuset_file, format!("{}", core));
                }
            }
        }
        Ok(())
    }

    /// Set resource limits before process execution
    pub fn apply_limits(&self, _memory_bytes: u64, _max_pids: u32) -> Result<()> {
        #[cfg(target_os = "linux")]
        {
            // 1. memory.max
            let mem_max = self.path.join("memory.max");
            if mem_max.exists() {
                fs::write(&mem_max, format!("{}", _memory_bytes))
                    .with_context(|| format!("Failed to write memory.max: {:?}", mem_max))?;
            }

            // 2. memory.swap.max set to 0 (strictly disable swap)
            let swap_max = self.path.join("memory.swap.max");
            if swap_max.exists() {
                let _ = fs::write(&swap_max, "0");
            }

            // 3. pids.max
            let pids_max = self.path.join("pids.max");
            if pids_max.exists() {
                fs::write(&pids_max, format!("{}", _max_pids))
                    .with_context(|| format!("Failed to write pids.max: {:?}", pids_max))?;
            }
        }
        Ok(())
    }

    /// Add a process PID into the cgroup (cgroup.procs)
    pub fn attach_pid(&self, _pid: u32) -> Result<()> {
        #[cfg(target_os = "linux")]
        {
            let procs_file = self.path.join("cgroup.procs");
            fs::write(&procs_file, format!("{}", _pid))
                .with_context(|| format!("Failed to attach PID {} to cgroup", _pid))?;
        }
        Ok(())
    }

    /// Atomically kill all processes in the cgroup
    pub fn kill(&self) -> Result<()> {
        #[cfg(target_os = "linux")]
        {
            let kill_file = self.path.join("cgroup.kill");
            if kill_file.exists() {
                let _ = fs::write(&kill_file, "1");
            }
        }
        Ok(())
    }

    /// Read usage statistics (CPU time and peak memory)
    pub fn read_stats(&self) -> Result<CgroupStats> {
        #[allow(unused_mut)]
        let mut stats = CgroupStats::default();

        #[cfg(target_os = "linux")]
        {
            // 1. Read cpu.stat (user_usec + system_usec)
            let cpu_stat = self.path.join("cpu.stat");
            if let Ok(content) = fs::read_to_string(&cpu_stat) {
                let mut user_us = 0u64;
                let mut sys_us = 0u64;
                for line in content.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() == 2 {
                        if parts[0] == "usage_usec" {
                            user_us = parts[1].parse().unwrap_or(0);
                        } else if parts[0] == "user_usec" {
                            user_us = parts[1].parse().unwrap_or(0);
                        } else if parts[0] == "system_usec" {
                            sys_us = parts[1].parse().unwrap_or(0);
                        }
                    }
                }
                stats.cpu_time_us = user_us + sys_us;
            }

            // 2. Read memory.peak
            let mem_peak = self.path.join("memory.peak");
            if let Ok(content) = fs::read_to_string(&mem_peak) {
                stats.peak_memory_bytes = content.trim().parse().unwrap_or(0);
            }
        }

        Ok(stats)
    }

    /// Reset slot state for reuse
    pub fn reset(&self) -> Result<()> {
        self.kill()?;
        Ok(())
    }
}
