use super::context::OrchestrationContext;
use super::evidence::CoverageEvidenceState;
use super::policy::OrchestrationPolicy;
use super::trace::OrchestrationDecisionTrace;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CacheReadMode {
    CacheOnly,
    CacheThenRelay,
    RelayOnly,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SurfaceReadPlan {
    pub cache_mode: CacheReadMode,
    pub relays_to_read: Vec<String>,
    pub use_scan_density: bool,
    pub trace: OrchestrationDecisionTrace,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedPrefetchPlan {
    pub should_prefetch: bool,
    pub reason: String,
    pub trace: OrchestrationDecisionTrace,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HydrationPlan {
    pub near_row_limit: usize,
    pub use_geometry: bool,
    pub trace: OrchestrationDecisionTrace,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RetentionHintPlan {
    pub prefer_optimizer_cleanup: bool,
    pub pressure: f64,
    pub trace: OrchestrationDecisionTrace,
}

#[must_use]
pub fn plan_surface_read(context: &OrchestrationContext) -> SurfaceReadPlan {
    let relays = context.enabled_selected_relays();
    let cache_mode = match context.coverage {
        CoverageEvidenceState::Complete => CacheReadMode::CacheOnly,
        CoverageEvidenceState::Partial => CacheReadMode::CacheThenRelay,
        CoverageEvidenceState::Missing => CacheReadMode::RelayOnly,
    };
    let mut trace = OrchestrationDecisionTrace::new(
        context.semantic_feed_key.clone(),
        "surface-read",
        context.now_ms,
    );
    trace.evidence = evidence(context);
    SurfaceReadPlan {
        relays_to_read: relay_reads_for_cache_mode(&cache_mode, relays),
        cache_mode,
        use_scan_density: context.optimizer.scan_density,
        trace,
    }
}

#[must_use]
pub fn plan_feed_prefetch(
    context: &OrchestrationContext,
    policy: &OrchestrationPolicy,
) -> FeedPrefetchPlan {
    let should =
        context.visible_owner && context.visible_row_count <= policy.viewport_prefetch_rows;
    FeedPrefetchPlan {
        should_prefetch: should,
        reason: if should {
            "viewport-fill"
        } else {
            "not-needed"
        }
        .to_owned(),
        trace: OrchestrationDecisionTrace::new(
            context.semantic_feed_key.clone(),
            "prefetch",
            context.now_ms,
        ),
    }
}

#[must_use]
pub fn plan_hydration(
    context: &OrchestrationContext,
    policy: &OrchestrationPolicy,
) -> HydrationPlan {
    HydrationPlan {
        near_row_limit: policy
            .hydration_near_rows
            .min(context.visible_row_count.saturating_add(8)),
        use_geometry: context.optimizer.row_geometry,
        trace: OrchestrationDecisionTrace::new(
            context.semantic_feed_key.clone(),
            "hydration",
            context.now_ms,
        ),
    }
}

#[must_use]
pub fn plan_cache_retention(
    context: &OrchestrationContext,
    policy: &OrchestrationPolicy,
) -> RetentionHintPlan {
    RetentionHintPlan {
        prefer_optimizer_cleanup: context.storage_pressure >= policy.high_storage_pressure,
        pressure: context.storage_pressure,
        trace: OrchestrationDecisionTrace::new(
            context.semantic_feed_key.clone(),
            "retention",
            context.now_ms,
        ),
    }
}

fn relay_reads_for_cache_mode(mode: &CacheReadMode, relays: Vec<String>) -> Vec<String> {
    match mode {
        CacheReadMode::CacheOnly => Vec::new(),
        CacheReadMode::CacheThenRelay | CacheReadMode::RelayOnly => relays,
    }
}

fn evidence(context: &OrchestrationContext) -> Vec<String> {
    [
        (context.optimizer.relay_scores, "relay-scores"),
        (context.optimizer.route_evidence, "route-evidence"),
        (context.optimizer.scan_density, "scan-density"),
        (context.optimizer.row_geometry, "row-geometry"),
    ]
    .iter()
    .filter(|(available, _name)| *available)
    .map(|(_available, name)| (*name).to_owned())
    .collect()
}
