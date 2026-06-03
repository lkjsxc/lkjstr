use crate::RouteEvidenceSource;

use super::trust::{RouteEvidenceTrustInput, route_evidence_trust_score};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MeasuredRouteEvidence {
    pub author: String,
    pub relay_url: String,
    pub source: RouteEvidenceSource,
    pub measured_success: u64,
    pub measured_failure: u64,
    pub last_success_at_ms: Option<u64>,
    pub last_failure_at_ms: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MergedRouteEvidence {
    pub author: String,
    pub relay_url: String,
    pub trust_score: i64,
}

#[must_use]
pub fn merge_route_evidence_scores(rows: &[MeasuredRouteEvidence]) -> Vec<MergedRouteEvidence> {
    let mut merged = rows
        .iter()
        .map(|row| MergedRouteEvidence {
            author: row.author.clone(),
            relay_url: row.relay_url.clone(),
            trust_score: route_evidence_trust_score(&RouteEvidenceTrustInput {
                source: row.source,
                measured_success: row.measured_success,
                measured_failure: row.measured_failure,
                timeout: false,
                auth_or_closed_or_error: false,
                repeated_no_yield: row.measured_failure > row.measured_success,
                stale_nip65: false,
            }),
        })
        .collect::<Vec<_>>();
    merged.sort_by(|left, right| {
        right
            .trust_score
            .cmp(&left.trust_score)
            .then_with(|| left.relay_url.cmp(&right.relay_url))
    });
    merged
}
