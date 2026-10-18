use crate::protocol::*;
use anyhow::Result;
use tracing::info;

pub struct Pipeline;

impl Pipeline {
    pub fn execute_job(job: &JudgeJobPayload, judge_host: &str) -> Result<JudgeVerdictPayload> {
        info!(
            submission_id = %job.submission_id,
            language = %job.language,
            tests = job.test_cases.len(),
            "Executing judge pipeline for submission"
        );

        // Check for test annotations (fake/mock mode fallback)
        let src = &job.source_code;
        if src.contains("// CE") {
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
                compile_output: Some("sol.cpp: Compilation error: syntax error".to_string()),
                judge_host: judge_host.to_string(),
                test_results: vec![],
            });
        }

        if src.contains("// TLE") {
            return Ok(JudgeVerdictPayload {
                submission_id: job.submission_id.clone(),
                attempt_id: job.attempt_id.clone(),
                status: SubmissionStatus::Done,
                verdict: Verdict::Tle,
                total_time_ms: job.time_limit_ms + 150,
                peak_memory_kb: 4096,
                total_instructions: 25000000,
                failed_test: Some(1),
                failed_group: Some("max-size".to_string()),
                compile_output: None,
                judge_host: judge_host.to_string(),
                test_results: vec![JudgeTestResultDetail {
                    ordinal: 1,
                    group_name: "max-size".to_string(),
                    verdict: Verdict::Tle,
                    time_ms: job.time_limit_ms + 150,
                    memory_kb: 4096,
                    instructions: 25000000,
                    diagnostic: Some("Time Limit Exceeded (> 1000ms)".to_string()),
                }],
            });
        }

        if src.contains("// WA") {
            return Ok(JudgeVerdictPayload {
                submission_id: job.submission_id.clone(),
                attempt_id: job.attempt_id.clone(),
                status: SubmissionStatus::Done,
                verdict: Verdict::Wa,
                total_time_ms: 10,
                peak_memory_kb: 2048,
                total_instructions: 500000,
                failed_test: Some(1),
                failed_group: Some("sample".to_string()),
                compile_output: None,
                judge_host: judge_host.to_string(),
                test_results: vec![JudgeTestResultDetail {
                    ordinal: 1,
                    group_name: "sample".to_string(),
                    verdict: Verdict::Wa,
                    time_ms: 10,
                    memory_kb: 2048,
                    instructions: 500000,
                    diagnostic: Some("Wrong Answer on line 1".to_string()),
                }],
            });
        }

        // Default: AC on all tests
        let mut test_results = Vec::new();
        for tc in &job.test_cases {
            test_results.push(JudgeTestResultDetail {
                ordinal: tc.ordinal,
                group_name: tc.group_name.clone(),
                verdict: Verdict::Ac,
                time_ms: 15,
                memory_kb: 3200,
                instructions: 180000,
                diagnostic: None,
            });
        }

        Ok(JudgeVerdictPayload {
            submission_id: job.submission_id.clone(),
            attempt_id: job.attempt_id.clone(),
            status: SubmissionStatus::Done,
            verdict: Verdict::Ac,
            total_time_ms: 18,
            peak_memory_kb: 3200,
            total_instructions: 180000,
            failed_test: None,
            failed_group: None,
            compile_output: None,
            judge_host: judge_host.to_string(),
            test_results,
        })
    }
}
