pub mod float;
pub mod token;

use float::FloatChecker;
use token::{CheckResult, TokenChecker};

pub struct CheckerDispatcher;

impl CheckerDispatcher {
    pub fn evaluate(
        checker_type: &str,
        participant_output: &[u8],
        expected_output: &[u8],
    ) -> CheckResult {
        match checker_type {
            "float" => FloatChecker::check(participant_output, expected_output, 1e-6),
            _ => TokenChecker::check(participant_output, expected_output),
        }
    }
}
