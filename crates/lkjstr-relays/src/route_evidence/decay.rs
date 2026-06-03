use super::source::{FRESH_NIP65_TRUST, STALE_NIP65_TRUST};

pub const NIP65_STALE_AFTER_MS: u64 = 7 * 24 * 60 * 60 * 1_000;

#[must_use]
pub fn nip65_trust_for_age(updated_at_ms: u64, now_ms: u64) -> i64 {
    if now_ms.saturating_sub(updated_at_ms) > NIP65_STALE_AFTER_MS {
        STALE_NIP65_TRUST
    } else {
        FRESH_NIP65_TRUST
    }
}
