use lkjstr_app::{CacheDisplayEvidence, CacheDisplayMode, cache_display_policy};

#[test]
fn proven_coverage_renders_normally() {
    assert_eq!(
        cache_display_policy(evidence(true, 1)),
        CacheDisplayMode::CoverageProven
    );
}

#[test]
fn mismatched_target_or_author_set_holds_cache() {
    let mut input = evidence(false, 1);
    input.target_matches = false;
    assert_eq!(cache_display_policy(input), CacheDisplayMode::HoldCache);
    let mut input = evidence(false, 1);
    input.author_set_matches = false;
    assert_eq!(cache_display_policy(input), CacheDisplayMode::HoldCache);
}

#[test]
fn biased_or_stale_cache_is_bounded_preview() {
    let mut input = evidence(false, 12);
    input.preview_limit = 6;
    assert_eq!(
        cache_display_policy(input),
        CacheDisplayMode::CachePreview { limit: 6 }
    );
    let mut input = evidence(false, 1);
    input.route_matches = false;
    assert_eq!(
        cache_display_policy(input),
        CacheDisplayMode::CachePreview { limit: 10 }
    );
}

fn evidence(coverage_proven: bool, dominant_author_run: usize) -> CacheDisplayEvidence {
    CacheDisplayEvidence {
        coverage_proven,
        target_matches: true,
        route_matches: true,
        selected_relays_match: true,
        author_set_matches: true,
        filter_shape_matches: true,
        interval_matches: true,
        dominant_author_run,
        preview_limit: 10,
    }
}
