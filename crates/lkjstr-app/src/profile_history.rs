#![doc = "Sparse profile history scan planner."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProfileScanInput {
    pub until: u64,
    pub span_seconds: u64,
    pub floor: u64,
    pub complete_empty: bool,
    pub dense: bool,
    pub incomplete: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProfileScanDecision {
    ContinueOlder {
        since: u64,
        until: u64,
        span_seconds: u64,
    },
    RetryDense {
        since: u64,
        until: u64,
        limit_multiplier: u8,
    },
    WaitForProof,
    EmptyProven,
}

#[must_use]
pub fn plan_profile_sparse_scan(input: ProfileScanInput) -> ProfileScanDecision {
    let since = input
        .until
        .saturating_sub(input.span_seconds)
        .max(input.floor);
    if input.incomplete {
        return ProfileScanDecision::WaitForProof;
    }
    if input.dense {
        return ProfileScanDecision::RetryDense {
            since,
            until: input.until,
            limit_multiplier: 4,
        };
    }
    if !input.complete_empty {
        return ProfileScanDecision::WaitForProof;
    }
    if since <= input.floor {
        return ProfileScanDecision::EmptyProven;
    }
    let next_until = since;
    let next_span = input.span_seconds.saturating_mul(2).max(input.span_seconds);
    ProfileScanDecision::ContinueOlder {
        since: next_until.saturating_sub(next_span).max(input.floor),
        until: next_until,
        span_seconds: next_span,
    }
}
