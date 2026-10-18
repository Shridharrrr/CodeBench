pub mod cgroup;
pub mod isolate;
pub mod native;
pub mod probe;
pub mod profile;
pub mod slot;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionLimits {
    pub cpu_time_ms: u64,
    pub wall_time_ms: u64,
    pub memory_limit_kb: u64,
    pub stack_limit_kb: u64,
    pub max_processes: u32,
    pub output_limit_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionUsage {
    pub cpu_time_ms: u64,
    pub wall_time_ms: u64,
    pub peak_memory_kb: u64,
    pub instructions: u64,
    pub exit_code: i32,
    pub signal: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SandboxVerdict {
    Success,
    TimeLimitExceeded,
    MemoryLimitExceeded,
    OutputLimitExceeded,
    RuntimeError(String),
    SystemError(String),
}

#[derive(Debug, Clone)]
pub struct ExecutionRequest {
    pub executable_path: PathBuf,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub stdin_data: Option<Vec<u8>>,
    pub stdin_path: Option<PathBuf>,
    pub limits: ExecutionLimits,
    pub profile: profile::SandboxProfile,
    pub slot_id: usize,
}

#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub verdict: SandboxVerdict,
    pub usage: ExecutionUsage,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub diagnostic: Option<String>,
}

/// Abstract Sandbox Runner trait.
/// Implemented by both NativeRunner (cgroups v2, namespaces, seccomp, landlock)
/// and IsolateAdapter (reference oracle).
pub trait SandboxRunner: Send + Sync {
    fn name(&self) -> &'static str;
    fn execute(&self, req: &ExecutionRequest) -> Result<ExecutionResult>;
}
