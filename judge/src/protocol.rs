use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SubmissionStatus {
    Queued,
    Compiling,
    Running,
    Judging,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Verdict {
    Pending,
    Ac,
    Wa,
    Tle,
    Mle,
    Ole,
    Re,
    Ce,
    Se,
    ComplexityFail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub id: String,
    pub problem_version_id: String,
    pub group_name: String,
    pub ordinal: i32,
    pub input_data: String,
    pub output_data: String,
    pub is_sample: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeJobPayload {
    pub submission_id: String,
    pub attempt_id: String,
    pub language: String,
    pub source_code: String,
    pub time_limit_ms: i64,
    pub memory_limit_kb: i64,
    pub checker_type: String,
    pub test_cases: Vec<TestCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeTestResultDetail {
    pub ordinal: i32,
    pub group_name: String,
    pub verdict: Verdict,
    pub time_ms: i64,
    pub memory_kb: i64,
    pub instructions: i64,
    pub diagnostic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeVerdictPayload {
    pub submission_id: String,
    pub attempt_id: String,
    pub status: SubmissionStatus,
    pub verdict: Verdict,
    pub total_time_ms: i64,
    pub peak_memory_kb: i64,
    pub total_instructions: i64,
    pub failed_test: Option<i32>,
    pub failed_group: Option<String>,
    pub compile_output: Option<String>,
    pub judge_host: String,
    pub test_results: Vec<JudgeTestResultDetail>,
}
