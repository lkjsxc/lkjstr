use crate::RouteEvidenceSource;

pub const RECEIPT_TRUST: i64 = 90;
pub const MEASURED_AUTHOR_SUCCESS_TRUST: i64 = 80;
pub const LOCAL_DISCOVERY_SUCCESS_TRUST: i64 = 65;
pub const EVENT_HINT_TRUST: i64 = 50;
pub const FRESH_NIP65_TRUST: i64 = 35;
pub const STALE_NIP65_TRUST: i64 = 15;

#[must_use]
pub const fn base_trust_for_source(source: RouteEvidenceSource) -> i64 {
    match source {
        RouteEvidenceSource::Receipt => RECEIPT_TRUST,
        RouteEvidenceSource::MeasuredAuthorSuccess => MEASURED_AUTHOR_SUCCESS_TRUST,
        RouteEvidenceSource::Discovery | RouteEvidenceSource::LocalDiscoverySuccess => {
            LOCAL_DISCOVERY_SUCCESS_TRUST
        }
        RouteEvidenceSource::Hint => EVENT_HINT_TRUST,
        RouteEvidenceSource::Nip65 => FRESH_NIP65_TRUST,
    }
}
