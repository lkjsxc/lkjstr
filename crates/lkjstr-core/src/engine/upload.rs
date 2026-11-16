//! Upload policy shared by browser effects and native regression tests.
/// Leave 15 seconds for transport/dispatch before the page's 300-second watchdog.
pub const UPLOAD_BUDGET_MS: u64 = 285_000;
#[derive(Clone, Copy)]
pub struct Deadline(u64);
impl Deadline {
    pub fn new(now: u64) -> Self {
        Self(now.saturating_add(UPLOAD_BUDGET_MS))
    }
    pub fn within(now: u64, budget: u64) -> Self {
        Self(now.saturating_add(budget))
    }
    /// Every discovery, signer, HTTP body and processing pause spends one budget.
    pub fn wait(self, now: u64, cap_ms: u32) -> Result<u32, &'static str> {
        let remaining = self.0.saturating_sub(now).min(u64::from(cap_ms)) as u32;
        if remaining == 0 {
            Err("upload-timeout")
        } else {
            Ok(remaining)
        }
    }
}
/// Fallback belongs to this attempt, independent of concurrent server verdicts.
pub struct AttemptFailure {
    pub code: &'static str,
    pub fallback: bool,
}
impl AttemptFailure {
    pub fn required(code: &'static str) -> Self {
        Self {
            code,
            fallback: code != "internal",
        }
    }
}
impl From<&'static str> for AttemptFailure {
    fn from(code: &'static str) -> Self {
        Self {
            code,
            fallback: false,
        }
    }
}
#[derive(Debug)]
pub struct Unavailable {
    pub code: String,
    pub server: Option<String>,
}
