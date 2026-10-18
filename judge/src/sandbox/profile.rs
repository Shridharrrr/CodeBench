use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SandboxProfileType {
    Compile,
    Run,
    Checker,
    Interactor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxProfile {
    pub profile_type: SandboxProfileType,
    pub max_processes: u32,
    pub memory_limit_bytes: u64,
    pub cpu_time_limit_ms: u64,
    pub wall_time_limit_ms: u64,
    pub stack_limit_bytes: u64,
    pub output_limit_bytes: u64,
    pub open_files_limit: u32,
    pub allow_network: bool,
    pub read_only_mounts: Vec<PathBuf>,
    pub tmpfs_mounts: Vec<PathBuf>,
    pub enable_instruction_counting: bool,
}

impl SandboxProfile {
    /// Strict participant run profile
    pub fn participant_run(time_limit_ms: u64, memory_limit_kb: u64) -> Self {
        Self {
            profile_type: SandboxProfileType::Run,
            max_processes: 1, // Strict single process: no forks/threads allowed
            memory_limit_bytes: memory_limit_kb * 1024,
            cpu_time_limit_ms: time_limit_ms,
            wall_time_limit_ms: time_limit_ms * 2 + 1000,
            stack_limit_bytes: 8 * 1024 * 1024,     // 8 MB stack
            output_limit_bytes: 64 * 1024 * 1024,   // 64 MB stdout/stderr cap
            open_files_limit: 16,
            allow_network: false,
            read_only_mounts: vec![
                PathBuf::from("/usr/lib"),
                PathBuf::from("/lib"),
                PathBuf::from("/lib64"),
            ],
            tmpfs_mounts: vec![PathBuf::from("/tmp")],
            enable_instruction_counting: true,
        }
    }

    /// Isolated compiler profile
    pub fn compiler(time_limit_ms: u64, memory_limit_mb: u64) -> Self {
        Self {
            profile_type: SandboxProfileType::Compile,
            max_processes: 16, // Compiler invokes cc1plus, as, ld
            memory_limit_bytes: memory_limit_mb * 1024 * 1024,
            cpu_time_limit_ms: time_limit_ms,
            wall_time_limit_ms: time_limit_ms * 2 + 2000,
            stack_limit_bytes: 32 * 1024 * 1024,
            output_limit_bytes: 16 * 1024 * 1024,
            open_files_limit: 256,
            allow_network: false,
            read_only_mounts: vec![
                PathBuf::from("/usr"),
                PathBuf::from("/lib"),
                PathBuf::from("/lib64"),
                PathBuf::from("/bin"),
            ],
            tmpfs_mounts: vec![PathBuf::from("/tmp")],
            enable_instruction_counting: false,
        }
    }

    /// Checker execution profile
    pub fn checker(time_limit_ms: u64, memory_limit_mb: u64) -> Self {
        Self {
            profile_type: SandboxProfileType::Checker,
            max_processes: 2,
            memory_limit_bytes: memory_limit_mb * 1024 * 1024,
            cpu_time_limit_ms: time_limit_ms,
            wall_time_limit_ms: time_limit_ms * 2,
            stack_limit_bytes: 16 * 1024 * 1024,
            output_limit_bytes: 32 * 1024 * 1024,
            open_files_limit: 32,
            allow_network: false,
            read_only_mounts: vec![PathBuf::from("/lib"), PathBuf::from("/usr/lib")],
            tmpfs_mounts: vec![PathBuf::from("/tmp")],
            enable_instruction_counting: false,
        }
    }
}
