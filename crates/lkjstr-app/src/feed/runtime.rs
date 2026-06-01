#![doc = "Pure feed runtime composition."]

use lkjstr_relays::{DemandVisibility, LiveLeaseState};

use crate::{
    FeedRuntimeInput, FeedRuntimeLeaseOutcome, FeedRuntimeLiveOutcome, FeedRuntimeState,
    FeedWindowEvidence, QueryDemandInput, empty_feed_window, plan_query_demand, reduce_feed_window,
};

#[must_use]
pub fn start_feed_runtime(input: FeedRuntimeInput) -> FeedRuntimeState {
    FeedRuntimeState {
        runtime_id: input.runtime_id,
        window: empty_feed_window(input.generation, input.max_items),
        live_fingerprint: None,
    }
}

#[must_use]
pub fn attach_feed_runtime_live(
    mut runtime: FeedRuntimeState,
    mut leases: LiveLeaseState,
    mut input: QueryDemandInput,
) -> FeedRuntimeLiveOutcome {
    input.owner = runtime.runtime_id.clone();
    let now_sec = input.now_sec;
    let plan = plan_query_demand(input);
    let mut effects = Vec::new();
    if runtime.live_fingerprint.as_ref() != Some(&plan.fingerprint)
        && let Some(previous) = runtime.live_fingerprint.take()
    {
        effects.extend(leases.release(&runtime.runtime_id, &previous).effects);
    }
    effects.extend(leases.attach(plan.demand.clone(), now_sec).effects);
    runtime.live_fingerprint = Some(plan.fingerprint.clone());
    FeedRuntimeLiveOutcome {
        runtime,
        leases,
        plan,
        effects,
    }
}

#[must_use]
pub fn release_feed_runtime_live(
    mut runtime: FeedRuntimeState,
    mut leases: LiveLeaseState,
) -> FeedRuntimeLeaseOutcome {
    let effects = runtime
        .live_fingerprint
        .take()
        .map_or_else(Vec::new, |fingerprint| {
            leases.release(&runtime.runtime_id, &fingerprint).effects
        });
    FeedRuntimeLeaseOutcome {
        runtime,
        leases,
        effects,
    }
}

#[must_use]
pub fn set_feed_runtime_visibility(
    runtime: FeedRuntimeState,
    mut leases: LiveLeaseState,
    visibility: DemandVisibility,
) -> FeedRuntimeLeaseOutcome {
    let effects = leases
        .set_owner_visibility(&runtime.runtime_id, visibility)
        .effects;
    FeedRuntimeLeaseOutcome {
        runtime,
        leases,
        effects,
    }
}

#[must_use]
pub fn reduce_feed_runtime_window(
    mut runtime: FeedRuntimeState,
    evidence: FeedWindowEvidence,
) -> FeedRuntimeState {
    runtime.window = reduce_feed_window(runtime.window, evidence);
    runtime
}
