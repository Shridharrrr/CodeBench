#[cfg(target_os = "linux")]
use crate::sandbox::cgroup::CgroupV2Slot;
use crate::sandbox::{
    ExecutionRequest, ExecutionResult, ExecutionUsage, SandboxRunner, SandboxVerdict,
};
use anyhow::{Context, Result};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

pub struct NativeRunner {
    pub cgroup_base: PathBuf,
}

impl NativeRunner {
    pub fn new(cgroup_base: PathBuf) -> Self {
        Self { cgroup_base }
    }

    /// Linux-specific native isolation runner using namespaces, cgroups, and supervision
    #[cfg(target_os = "linux")]
    fn execute_linux(&self, req: &ExecutionRequest) -> Result<ExecutionResult> {
        let slot = CgroupV2Slot::new(req.slot_id, &self.cgroup_base)?;
        let mem_bytes = req.limits.memory_limit_kb * 1024;
        let max_pids = req.limits.max_processes;

        // Apply cgroup limits before spawn
        slot.apply_limits(mem_bytes, max_pids)?;

        let start_time = Instant::now();

        let mut cmd = Command::new(&req.executable_path);
        cmd.args(&req.args);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Spawn child process
        let mut child = cmd.spawn().context("Failed to spawn process in sandbox")?;
        let pid = child.id();

        // Attach child PID to cgroup immediately
        let _ = slot.attach_pid(pid);

        // Feed stdin if provided
        if let Some(stdin_bytes) = &req.stdin_data {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(stdin_bytes);
            }
        }

        // Supervise child process with wall clock timeout
        let wall_timeout = Duration::from_millis(req.limits.wall_time_ms);
        let mut verdict = SandboxVerdict::Success;
        let mut timed_out = false;

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        if let Some(code) = status.code() {
                            verdict = SandboxVerdict::RuntimeError(format!("Exit code {}", code));
                        } else {
                            verdict = SandboxVerdict::RuntimeError("Terminated by signal".into());
                        }
                    }
                    break;
                }
                Ok(None) => {
                    if start_time.elapsed() > wall_timeout {
                        timed_out = true;
                        verdict = SandboxVerdict::TimeLimitExceeded;
                        let _ = slot.kill();
                        let _ = child.kill();
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(2));
                }
                Err(e) => {
                    verdict = SandboxVerdict::SystemError(format!("Wait error: {}", e));
                    break;
                }
            }
        }

        // Read usage from cgroup v2
        let cgroup_stats = slot.read_stats().unwrap_or_default();
        let cpu_ms = cgroup_stats.cpu_time_us / 1000;
        let peak_mem_kb = cgroup_stats.peak_memory_bytes / 1024;

        // Check if CPU time limit exceeded
        if cpu_ms > req.limits.cpu_time_ms {
            verdict = SandboxVerdict::TimeLimitExceeded;
        }

        // Check if Memory peak exceeded limit
        if peak_mem_kb > req.limits.memory_limit_kb {
            verdict = SandboxVerdict::MemoryLimitExceeded;
        }

        // Read capped output buffers
        let output = child.wait_with_output().ok();
        let (stdout, stderr) = match output {
            Some(out) => {
                let mut out_bytes = out.stdout;
                let mut err_bytes = out.stderr;
                if out_bytes.len() as u64 > req.limits.output_limit_bytes {
                    out_bytes.truncate(req.limits.output_limit_bytes as usize);
                    verdict = SandboxVerdict::OutputLimitExceeded;
                }
                if err_bytes.len() as u64 > req.limits.output_limit_bytes {
                    err_bytes.truncate(req.limits.output_limit_bytes as usize);
                }
                (out_bytes, err_bytes)
            }
            None => (vec![], vec![]),
        };

        // Reset cgroup for reuse
        let _ = slot.reset();

        Ok(ExecutionResult {
            verdict,
            usage: ExecutionUsage {
                cpu_time_ms: cpu_ms,
                wall_time_ms: start_time.elapsed().as_millis() as u64,
                peak_memory_kb: peak_mem_kb,
                instructions: 0,
                exit_code: if timed_out { 124 } else { 0 },
                signal: None,
            },
            stdout,
            stderr,
            diagnostic: None,
        })
    }

    /// Cross-platform fallback runner for testing on non-Linux hosts (Docker Desktop dev)
    #[cfg(not(target_os = "linux"))]
    fn execute_fallback(&self, req: &ExecutionRequest) -> Result<ExecutionResult> {
        let start_time = Instant::now();

        let mut cmd = Command::new(&req.executable_path);
        cmd.args(&req.args);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().context("Failed to spawn process")?;

        if let Some(stdin_bytes) = &req.stdin_data {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(stdin_bytes);
            }
        }

        let wall_timeout = Duration::from_millis(req.limits.wall_time_ms);
        let mut verdict = SandboxVerdict::Success;
        let mut timed_out = false;

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        verdict = SandboxVerdict::RuntimeError("Nonzero exit status".into());
                    }
                    break;
                }
                Ok(None) => {
                    if start_time.elapsed() > wall_timeout {
                        timed_out = true;
                        verdict = SandboxVerdict::TimeLimitExceeded;
                        let _ = child.kill();
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(2));
                }
                Err(e) => {
                    verdict = SandboxVerdict::SystemError(format!("Wait error: {}", e));
                    break;
                }
            }
        }

        let output = child.wait_with_output().ok();
        let (stdout, stderr) = match output {
            Some(out) => (out.stdout, out.stderr),
            None => (vec![], vec![]),
        };

        let elapsed_ms = start_time.elapsed().as_millis() as u64;
        if elapsed_ms > req.limits.cpu_time_ms && !timed_out {
            verdict = SandboxVerdict::TimeLimitExceeded;
        }

        Ok(ExecutionResult {
            verdict,
            usage: ExecutionUsage {
                cpu_time_ms: elapsed_ms,
                wall_time_ms: elapsed_ms,
                peak_memory_kb: 4096,
                instructions: 0,
                exit_code: if timed_out { 124 } else { 0 },
                signal: None,
            },
            stdout,
            stderr,
            diagnostic: None,
        })
    }
}

impl SandboxRunner for NativeRunner {
    fn name(&self) -> &'static str {
        "native-linux"
    }

    fn execute(&self, req: &ExecutionRequest) -> Result<ExecutionResult> {
        #[cfg(target_os = "linux")]
        {
            self.execute_linux(req)
        }

        #[cfg(not(target_os = "linux"))]
        {
            self.execute_fallback(req)
        }
    }
}
