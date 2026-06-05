#![doc = "Cache display policy for incomplete feed coverage."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CacheDisplayEvidence {
    pub coverage_proven: bool,
    pub target_matches: bool,
    pub route_matches: bool,
    pub selected_relays_match: bool,
    pub author_set_matches: bool,
    pub filter_shape_matches: bool,
    pub interval_matches: bool,
    pub dominant_author_run: usize,
    pub preview_limit: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CacheDisplayMode {
    CoverageProven,
    CachePreview { limit: usize },
    HoldCache,
    RelayRefreshing,
    Complete,
}

#[must_use]
pub fn cache_display_policy(input: CacheDisplayEvidence) -> CacheDisplayMode {
    if input.coverage_proven
        && input.target_matches
        && input.route_matches
        && input.selected_relays_match
        && input.author_set_matches
        && input.filter_shape_matches
        && input.interval_matches
    {
        return CacheDisplayMode::CoverageProven;
    }
    if !input.target_matches || !input.author_set_matches || !input.filter_shape_matches {
        return CacheDisplayMode::HoldCache;
    }
    let biased = input.dominant_author_run > input.preview_limit.max(1);
    if biased || !input.route_matches || !input.selected_relays_match || !input.interval_matches {
        return CacheDisplayMode::CachePreview {
            limit: input.preview_limit.max(1),
        };
    }
    CacheDisplayMode::RelayRefreshing
}

#[must_use]
pub const fn complete_cache_display() -> CacheDisplayMode {
    CacheDisplayMode::Complete
}
