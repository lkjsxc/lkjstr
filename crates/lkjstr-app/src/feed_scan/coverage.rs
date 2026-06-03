#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoverageGap {
    pub since_seconds: u64,
    pub until_seconds: u64,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
}

impl CoverageGap {
    pub fn new(
        since_seconds: u64,
        until_seconds: u64,
        route_group_key: impl Into<String>,
        relay_url: impl Into<String>,
        semantic_filter_key: impl Into<String>,
    ) -> Self {
        Self {
            since_seconds,
            until_seconds,
            route_group_key: route_group_key.into(),
            relay_url: relay_url.into(),
            semantic_filter_key: semantic_filter_key.into(),
        }
    }
}

pub fn scan_hint_proves_cache_absence() -> bool {
    false
}

pub fn should_query_uncovered_relay(gap: &CoverageGap) -> bool {
    gap.until_seconds > gap.since_seconds
        && !gap.route_group_key.is_empty()
        && !gap.relay_url.is_empty()
        && !gap.semantic_filter_key.is_empty()
}
