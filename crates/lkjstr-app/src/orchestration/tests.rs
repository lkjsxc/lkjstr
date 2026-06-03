use super::*;

fn context(coverage: CoverageEvidenceState) -> OrchestrationContext {
    OrchestrationContext {
        surface: SurfaceKind::Home,
        semantic_feed_key: "home:account:selected".to_owned(),
        route_group_key: "selected".to_owned(),
        selected_relays: vec!["wss://a.example/".to_owned(), "wss://b.example/".to_owned()],
        disabled_relays: vec!["wss://b.example/".to_owned()],
        coverage,
        optimizer: OptimizerEvidenceState {
            relay_scores: true,
            route_evidence: false,
            scan_density: true,
            row_geometry: true,
        },
        visible_owner: true,
        visible_row_count: 4,
        storage_pressure: 0.9,
        now_ms: 10,
    }
}

#[test]
fn complete_coverage_uses_cache_without_relay_reads() {
    let plan = plan_surface_read(&context(CoverageEvidenceState::Complete));

    assert_eq!(plan.cache_mode, CacheReadMode::CacheOnly);
    assert!(plan.relays_to_read.is_empty());
    assert!(plan.use_scan_density);
}

#[test]
fn partial_coverage_reads_enabled_selected_relays() {
    let plan = plan_surface_read(&context(CoverageEvidenceState::Partial));

    assert_eq!(plan.cache_mode, CacheReadMode::CacheThenRelay);
    assert_eq!(plan.relays_to_read, vec!["wss://a.example/".to_owned()]);
}

#[test]
fn missing_coverage_reads_relays_but_keeps_disabled_excluded() {
    let plan = plan_surface_read(&context(CoverageEvidenceState::Missing));

    assert_eq!(plan.cache_mode, CacheReadMode::RelayOnly);
    assert!(!plan.relays_to_read.contains(&"wss://b.example/".to_owned()));
}

#[test]
fn short_visible_feed_prefetches_for_viewport_fill() {
    let policy = OrchestrationPolicy::default();
    let plan = plan_feed_prefetch(&context(CoverageEvidenceState::Partial), &policy);

    assert!(plan.should_prefetch);
    assert_eq!(plan.reason, "viewport-fill");
}

#[test]
fn hydration_uses_row_geometry_when_available() {
    let policy = OrchestrationPolicy::default();
    let plan = plan_hydration(&context(CoverageEvidenceState::Partial), &policy);

    assert!(plan.use_geometry);
    assert!(plan.near_row_limit >= 4);
}

#[test]
fn high_pressure_prefers_optimizer_cleanup_first() {
    let policy = OrchestrationPolicy::default();
    let plan = plan_cache_retention(&context(CoverageEvidenceState::Partial), &policy);

    assert!(plan.prefer_optimizer_cleanup);
    assert_eq!(plan.trace.decision, "retention");
}
