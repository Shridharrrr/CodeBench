use crate::checker::token::CheckResult;

pub struct FloatChecker;

impl FloatChecker {
    /// Compares float tokens with relative or absolute precision epsilon tolerance
    pub fn check(participant_output: &[u8], expected_output: &[u8], epsilon: f64) -> CheckResult {
        let p_str = String::from_utf8_lossy(participant_output);
        let e_str = String::from_utf8_lossy(expected_output);

        let mut p_tokens = p_str.split_whitespace();
        let mut e_tokens = e_str.split_whitespace();

        let mut token_idx = 0;
        loop {
            match (p_tokens.next(), e_tokens.next()) {
                (Some(p), Some(e)) => {
                    token_idx += 1;
                    let p_val: f64 = match p.parse() {
                        Ok(v) => v,
                        Err(_) => {
                            return CheckResult::WrongAnswer {
                                message: format!("Token #{}: cannot parse '{}' as float", token_idx, p),
                            }
                        }
                    };
                    let e_val: f64 = match e.parse() {
                        Ok(v) => v,
                        Err(_) => {
                            return CheckResult::WrongAnswer {
                                message: format!("Token #{}: cannot parse expected '{}' as float", token_idx, e),
                            }
                        }
                    };

                    let diff = (p_val - e_val).abs();
                    let relative_diff = if e_val.abs() > 1e-9 { diff / e_val.abs() } else { diff };

                    if diff > epsilon && relative_diff > epsilon {
                        return CheckResult::WrongAnswer {
                            message: format!(
                                "Token #{}: float mismatch expected {:.6}, got {:.6} (diff: {:.6})",
                                token_idx, e_val, p_val, diff
                            ),
                        };
                    }
                }
                (None, None) => return CheckResult::Accepted,
                (Some(_), None) => {
                    return CheckResult::WrongAnswer {
                        message: "Extra tokens in output".to_string(),
                    }
                }
                (None, Some(_)) => {
                    return CheckResult::WrongAnswer {
                        message: "Missing tokens in output".to_string(),
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_float_checker_tolerance() {
        let p = b"3.1415926\n";
        let e = b"3.1415927\n";
        assert_eq!(FloatChecker::check(p, e, 1e-5), CheckResult::Accepted);
    }

    #[test]
    fn test_float_checker_mismatch() {
        let p = b"3.14\n";
        let e = b"3.14159\n";
        assert!(matches!(
            FloatChecker::check(p, e, 1e-5),
            CheckResult::WrongAnswer { .. }
        ));
    }
}
