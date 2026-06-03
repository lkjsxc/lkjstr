#![doc = "Measured route evidence trust reducers."]

mod decay;
mod merge;
mod source;
mod trust;

pub use decay::{NIP65_STALE_AFTER_MS, nip65_trust_for_age};
pub use merge::{MeasuredRouteEvidence, MergedRouteEvidence, merge_route_evidence_scores};
pub use source::{
    EVENT_HINT_TRUST, FRESH_NIP65_TRUST, LOCAL_DISCOVERY_SUCCESS_TRUST,
    MEASURED_AUTHOR_SUCCESS_TRUST, RECEIPT_TRUST, STALE_NIP65_TRUST, base_trust_for_source,
};
pub use trust::{
    ERROR_PENALTY, FAILURE_REPEAT_CAP, NO_YIELD_PENALTY, RouteEvidenceTrustInput, SUCCESS_BONUS,
    TIMEOUT_PENALTY, route_evidence_trust_score,
};

#[cfg(test)]
mod tests;
