use crate::sandbox::{
    ExecutionLimits, ExecutionRequest, ExecutionResult, ExecutionUsage, SandboxRunner,
    SandboxVerdict,
};
use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tracing::{debug, info};

pub struct IsolateAdapter {
    pub isolate_binary: PathBuf,
}

impl IsolateAdapter {
    pub fn new() -> Self {
        Self {
            isolate_binary: PathBuf::from("isolate"),
        }
    }
}

impl SandboxRunner for IsolateAdapter {
    fn name(&self) -> &'static str {
        "isolate-reference"
    }

    fn execute(&self, req: &ExecutionRequest) -> Result<ExecutionResult> {
        let box_id = req.slot_id.to_string();

        // 1. Initialize isolate box: isolate --cg -b <id> --init
        let init_status = Command::new(&self.isolate_binary)
            .args(["--cg", "-b", &box_id, "--init"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        if let Err(e) = init_status {
            return Ok(ExecutionResult {
                verdict: SandboxVerdict::SystemError(format!("isolate not available: {}", e)),
                usage: ExecutionUsage {
                    cpu_time_ms: 0,
                    wall_time_ms: 0,
                    peak_memory_kb: 0,
                    instructions: 0,
                    exit_code: -1,
                    signal: None,
                },
                stdout: vec![],
                stderr: vec![],
                diagnostic: Some("isolate binary missing from host".to_string()),
            });
        }

        let meta_file = std::env::temp_dir().join(format!("isolate-meta-{}.txt", box_id));

        // 2. Build isolate run arguments
        let time_sec = format!("{:.3}", req.limits.cpu_time_ms as f64 / 1000.0);
        let wall_sec = format!("{:.3}", req.limits.wall_time_ms as f64 / 1000.0);
        let mem_kb = format!("{}", req.limits.memory_limit_kb);
        let max_pids = format!("{}", req.limits.max_processes);

        let mut cmd = Command::new(&self.isolate_binary);
        cmd.args([
            "--cg",
            "-b",
            &box_id,
            "--run",
            "-t",
            &time_sec,
            "-w",
            &wall_sec,
            "-m",
            &mem_kb,
            "-p",
            &max_pids,
            "--meta",
            meta_file.to_str().unwrap(),
        ]);

        if let Some(ref stdin_p) = req.stdin_path {
            cmd.arg("-i").arg(stdin_p);
        }

        cmd.arg("--").arg(&req.executable_path);
        for a in &req.args {
            cmd.arg(a);
        }

        let output = cmd.output().context("Failed to run isolate")?;

        // 3. Read meta file
        let mut cpu_ms = 0u64;
        let mut mem_kb_used = 0u64;
        let mut verdict = SandboxVerdict::Success;
        let mut exit_code = output.status.code().unwrap_or(0);
        let mut signal = None;

        if let Ok(meta_content) = fs::read_to_string(&meta_file) {
            let _ = fs::remove_file(&meta_file);
            for line in meta_content.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    match k {
                        "time" => {
                            if let Ok(sec) = v.parse::<f64>() {
                                cpu_ms = (sec * 1000.0) as u64;
                            }
                        }
                        "max-rss" => {
                            mem_kb_used = v.parse().unwrap_or(0);
                        }
                        "status" => match v {
                            "TO" => verdict = SandboxVerdict::TimeLimitExceeded,
                            "RE" => verdict = SandboxVerdict::RuntimeError("Signal or nonzero exit".into()),
                            "SG" => verdict = SandboxVerdict::RuntimeError("Caught fatal signal".into()),
                            "OL" => verdict = SandboxVerdict::OutputLimitExceeded,
                            _ => {}
                        },
                        "exitcode" => {
                            exit_code = v.parse().unwrap_or(exit_code);
                        }
                        "exitsig" => {
                            signal = v.parse().ok();
                        }
                        _ => {}
                    }
                }
            }
        }

        // Cleanup isolate box
        let _ = Command::new(&self.isolate_binary)
            .args(["--cg", "-b", &box_id, "--cleanup"])
            .output();

        Ok(ExecutionResult {
            verdict,
            usage: ExecutionUsage {
                cpu_time_ms: cpu_ms,
                wall_time_ms: 0,
                peak_memory_kb: mem_kb_used,
                instructions: 0,
                exit_code,
                signal,
            },
            stdout: output.stdout,
            stderr: output.stderr,
            diagnostic: None,
        })
    }
}
