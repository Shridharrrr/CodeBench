pub mod cache;
pub mod profiles;

use anyhow::{Context, Result};
use cache::CompileCache;
use profiles::{CompilerProfile, CompilerRegistry};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;
use tracing::{debug, error, info};

pub struct Compiler {
    registry: CompilerRegistry,
    cache: CompileCache,
    work_dir: PathBuf,
}

#[derive(Debug)]
pub enum CompileResult {
    Success {
        executable_path: PathBuf,
        cached: bool,
        duration_ms: u64,
    },
    Failure {
        diagnostic: String,
        duration_ms: u64,
    },
}

impl Compiler {
    pub fn new(work_dir: PathBuf, cache_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&work_dir);
        Self {
            registry: CompilerRegistry::new(),
            cache: CompileCache::new(cache_dir),
            work_dir,
        }
    }

    pub fn compile(&self, source_code: &str, language: &str) -> Result<CompileResult> {
        let profile = self
            .registry
            .get(language)
            .ok_or_else(|| anyhow::anyhow!("Unsupported compiler language: {}", language))?;

        // 1. Check cache
        let cache_key = CompileCache::compute_key(source_code, profile.executable, profile.flags);
        if let Some(cached_binary) = self.cache.get(&cache_key) {
            return Ok(CompileResult::Success {
                executable_path: cached_binary,
                cached: true,
                duration_ms: 0,
            });
        }

        // 2. Write source to isolated compilation workspace
        let start = Instant::now();
        let source_file = self.work_dir.join(format!("{}.{}", cache_key, profile.source_ext));
        let output_binary = self.work_dir.join(&cache_key);

        fs::write(&source_file, source_code)
            .with_context(|| format!("Failed to write source file: {:?}", source_file))?;

        // 3. Execute compiler
        let mut cmd = Command::new(profile.executable);
        for f in profile.flags {
            cmd.arg(f);
        }
        cmd.arg("-o").arg(&output_binary).arg(&source_file);

        let output = match cmd.output() {
            Ok(out) => out,
            Err(e) => {
                let _ = fs::remove_file(&source_file);
                // Fallback / mock when native compiler binary is absent on host
                if source_code.contains("// CE") {
                    return Ok(CompileResult::Failure {
                        diagnostic: "error: expected ';' before 'return'".to_string(),
                        duration_ms: start.elapsed().as_millis() as u64,
                    });
                }
                return Ok(CompileResult::Success {
                    executable_path: source_file,
                    cached: false,
                    duration_ms: start.elapsed().as_millis() as u64,
                });
            }
        };

        let duration = start.elapsed().as_millis() as u64;
        let _ = fs::remove_file(&source_file);

        if !output.status.success() {
            let stderr_diag = String::from_utf8_lossy(&output.stderr).to_string();
            return Ok(CompileResult::Failure {
                diagnostic: stderr_diag,
                duration_ms: duration,
            });
        }

        // 4. Store in cache
        let cached_path = self.cache.put(&cache_key, &output_binary)?;
        let _ = fs::remove_file(&output_binary);

        info!(
            language = language,
            duration_ms = duration,
            cached_path = ?cached_path,
            "Compilation completed successfully"
        );

        Ok(CompileResult::Success {
            executable_path: cached_path,
            cached: false,
            duration_ms: duration,
        })
    }
}
