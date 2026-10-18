use crate::checker::token::CheckResult;
use crate::checker::CheckerDispatcher;
use crate::compiler::{CompileResult, Compiler};
use crate::protocol::*;
use crate::sandbox::profile::SandboxProfile;
use crate::sandbox::{ExecutionLimits, ExecutionRequest, SandboxRunner, SandboxVerdict};
use anyhow::Result;
use std::path::PathBuf;
use tracing::{debug, error, info};

pub struct JudgePipeline {
    compiler: Compiler,
    runner: Box<dyn SandboxRunner>,
}

impl JudgePipeline {
    pub fn new(runner: Box<dyn SandboxRunner>, work_dir: PathBuf, cache_dir: PathBuf) -> Self {
        Self {
            compiler: Compiler::new(work_dir, cache_dir),
            runner,
        }
    }

    pub fn execute(&self, job: &JudgeJobPayload, judge_host: &str) -> Result<JudgeVerdictPayload> {
        info!(
            submission_id = %job.submission_id,
            language = %job.language,
            test_count = job.test_cases.len(),
            "Starting sandbox evaluation pipeline"
        );

        // 1. Stage: Compile (cached or isolated compilation)
        let compile_res = self.compiler.compile(&job.source_code, &job.language)?;
        let executable_path = match compile_res {
            CompileResult::Success { executable_path, cached, duration_ms } => {
                debug!(cached = cached, duration_ms = duration_ms, "Compilation successful");
                executable_path
            }
            CompileResult::Failure { diagnostic, .. } => {
                info!(submission_id = %job.submission_id, "Compilation failed (CE)");
                return Ok(JudgeVerdictPayload {
                    submission_id: job.submission_id.clone(),
                    attempt_id: job.attempt_id.clone(),
                    status: SubmissionStatus::Done,
                    verdict: Verdict::Ce,
                    total_time_ms: 0,
                    peak_memory_kb: 0,
                    total_instructions: 0,
                    failed_test: None,
                    failed_group: None,
                    compile_output: Some(diagnostic),
                    judge_host: judge_host.to_string(),
                    test_results: vec![],
                });
            }
        };

        // 2. Stage: Execute Test Cases
        let mut test_results = Vec::new();
        let mut max_time_ms = 0u64;
        let mut peak_mem_kb = 0u64;
        let mut total_instructions = 0u64;
        let mut final_verdict = Verdict::Ac;
        let mut failed_test_ordinal: Option<i32> = None;
        let mut failed_group: Option<String> = None;

        let limits = ExecutionLimits {
            cpu_time_ms: job.time_limit_ms as u64,
            wall_time_ms: (job.time_limit_ms * 2 + 1000) as u64,
            memory_limit_kb: job.memory_limit_kb as u64,
            stack_limit_kb: 8192,
            max_processes: 1,
            output_limit_bytes: 64 * 1024 * 1024,
        };

        let profile = SandboxProfile::participant_run(limits.cpu_time_ms, limits.memory_limit_kb);

        for tc in &job.test_cases {
            let req = ExecutionRequest {
                executable_path: executable_path.clone(),
                args: vec![],
                env: vec![("ONLINE_JUDGE".to_string(), "1".to_string())],
                stdin_data: Some(tc.input_data.as_bytes().to_vec()),
                stdin_path: None,
                limits: limits.clone(),
                profile: profile.clone(),
                slot_id: 0,
            };

            let exec_result = match self.runner.execute(&req) {
                Ok(res) => res,
                Err(e) => {
                    error!(test_ordinal = tc.ordinal, error = %e, "Sandbox runner system error");
                    return Ok(JudgeVerdictPayload {
                        submission_id: job.submission_id.clone(),
                        attempt_id: job.attempt_id.clone(),
                        status: SubmissionStatus::Done,
                        verdict: Verdict::Se,
                        total_time_ms: 0,
                        peak_memory_kb: 0,
                        total_instructions: 0,
                        failed_test: Some(tc.ordinal),
                        failed_group: Some(tc.group_name.clone()),
                        compile_output: None,
                        judge_host: judge_host.to_string(),
                        test_results,
                    });
                }
            };

            if exec_result.usage.cpu_time_ms > max_time_ms {
                max_time_ms = exec_result.usage.cpu_time_ms;
            }
            if exec_result.usage.peak_memory_kb > peak_mem_kb {
                peak_mem_kb = exec_result.usage.peak_memory_kb;
            }
            total_instructions += exec_result.usage.instructions;

            let mut tc_verdict = match exec_result.verdict {
                SandboxVerdict::Success => Verdict::Pending,
                SandboxVerdict::TimeLimitExceeded => Verdict::Tle,
                SandboxVerdict::MemoryLimitExceeded => Verdict::Mle,
                SandboxVerdict::OutputLimitExceeded => Verdict::Ole,
                SandboxVerdict::RuntimeError(_) => Verdict::Re,
                SandboxVerdict::SystemError(_) => Verdict::Se,
            };

            let mut diagnostic = exec_result.diagnostic;

            // Check correctness if run succeeded without crashing or limit breach
            if tc_verdict == Verdict::Pending {
                let check = CheckerDispatcher::evaluate(
                    &job.checker_type,
                    &exec_result.stdout,
                    tc.output_data.as_bytes(),
                );

                match check {
                    CheckResult::Accepted => {
                        tc_verdict = Verdict::Ac;
                    }
                    CheckResult::WrongAnswer { message } => {
                        tc_verdict = Verdict::Wa;
                        diagnostic = Some(message);
                    }
                }
            }

            test_results.push(JudgeTestResultDetail {
                ordinal: tc.ordinal,
                group_name: tc.group_name.clone(),
                verdict: tc_verdict.clone(),
                time_ms: exec_result.usage.cpu_time_ms as i64,
                memory_kb: exec_result.usage.peak_memory_kb as i64,
                instructions: exec_result.usage.instructions as i64,
                diagnostic,
            });

            // Fail fast on first non-AC test case
            if tc_verdict != Verdict::Ac {
                final_verdict = tc_verdict;
                failed_test_ordinal = Some(tc.ordinal);
                failed_group = Some(tc.group_name.clone());
                debug!(
                    test_ordinal = tc.ordinal,
                    verdict = ?final_verdict,
                    "Test case failed, halting further test runs (fail-fast)"
                );
                break;
            }
        }

        info!(
            submission_id = %job.submission_id,
            verdict = ?final_verdict,
            max_time_ms = max_time_ms,
            peak_mem_kb = peak_mem_kb,
            "Finished judging submission"
        );

        Ok(JudgeVerdictPayload {
            submission_id: job.submission_id.clone(),
            attempt_id: job.attempt_id.clone(),
            status: SubmissionStatus::Done,
            verdict: final_verdict,
            total_time_ms: max_time_ms as i64,
            peak_memory_kb: peak_mem_kb as i64,
            total_instructions: total_instructions as i64,
            failed_test: failed_test_ordinal,
            failed_group,
            compile_output: None,
            judge_host: judge_host.to_string(),
            test_results,
        })
    }
}
