use crate::RouteEvidenceSource;

use super::source::base_trust_for_source;

pub const TIMEOUT_PENALTY: i64 = 30;
pub const ERROR_PENALTY: i64 = 35;
pub const NO_YIELD_PENALTY: i64 = 20;
pub const SUCCESS_BONUS: i64 = 5;
pub const FAILURE_REPEAT_CAP: u64 = 3;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RouteEvidenceTrustInput {
    pub source: RouteEvidenceSource,
    pub measured_success: u64,
    pub measured_failure: u64,
    pub timeout: bool,
    pub auth_or_closed_or_error: bool,
    pub repeated_no_yield: bool,
    pub stale_nip65: bool,
}

#[must_use]
pub fn route_evidence_trust_score(input: &RouteEvidenceTrustInput) -> i64 {
    let base = if input.stale_nip65 && input.source == RouteEvidenceSource::Nip65 {
        super::source::STALE_NIP65_TRUST
    } else {
        base_trust_for_source(input.source)
    };
    let success = success_bonus(input.measured_success);
    let failure = failure_penalty(input.measured_failure);
    base + success
        - failure
        - flag(input.timeout, TIMEOUT_PENALTY)
        - flag(input.auth_or_closed_or_error, ERROR_PENALTY)
        - flag(input.repeated_no_yield, NO_YIELD_PENALTY)
}

fn success_bonus(count: u64) -> i64 {
    count.min(FAILURE_REPEAT_CAP) as i64 * SUCCESS_BONUS
}

fn failure_penalty(count: u64) -> i64 {
    count.min(FAILURE_REPEAT_CAP) as i64 * NO_YIELD_PENALTY
}

fn flag(value: bool, penalty: i64) -> i64 {
    if value { penalty } else { 0 }
}
