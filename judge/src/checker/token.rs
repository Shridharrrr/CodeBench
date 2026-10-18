pub struct TokenChecker;

#[derive(Debug, PartialEq, Eq)]
pub enum CheckResult {
    Accepted,
    WrongAnswer { message: String },
}

impl TokenChecker {
    /// Compares participant output against expected output token by token,
    /// ignoring trailing whitespace, blank lines, and differences in CRLF / LF.
    pub fn check(participant_output: &[u8], expected_output: &[u8]) -> CheckResult {
        let p_str = String::from_utf8_lossy(participant_output);
        let e_str = String::from_utf8_lossy(expected_output);

        let mut p_tokens = p_str.split_whitespace();
        let mut e_tokens = e_str.split_whitespace();

        let mut token_idx = 0;
        loop {
            match (p_tokens.next(), e_tokens.next()) {
                (Some(p), Some(e)) => {
                    token_idx += 1;
                    if p != e {
                        return CheckResult::WrongAnswer {
                            message: format!(
                                "Token #{} mismatch: expected '{}', got '{}'",
                                token_idx, e, p
                            ),
                        };
                    }
                }
                (None, None) => return CheckResult::Accepted,
                (Some(extra), None) => {
                    return CheckResult::WrongAnswer {
                        message: format!(
                            "Extra token in output after token #{}: '{}'",
                            token_idx, extra
                        ),
                    };
                }
                (None, Some(missing)) => {
                    return CheckResult::WrongAnswer {
                        message: format!(
                            "Missing token after token #{}: expected '{}'",
                            token_idx, missing
                        ),
                    };
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_checker_accepted() {
        let p = b"0 1\n";
        let e = b"0   1\r\n\n";
        assert_eq!(TokenChecker::check(p, e), CheckResult::Accepted);
    }

    #[test]
    fn test_token_checker_wrong_answer() {
        let p = b"0 2\n";
        let e = b"0 1\n";
        assert!(matches!(
            TokenChecker::check(p, e),
            CheckResult::WrongAnswer { .. }
        ));
    }

    #[test]
    fn test_token_checker_extra_tokens() {
        let p = b"0 1 2\n";
        let e = b"0 1\n";
        assert!(matches!(
            TokenChecker::check(p, e),
            CheckResult::WrongAnswer { .. }
        ));
    }
}
