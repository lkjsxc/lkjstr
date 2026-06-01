#![doc = "Feed runtime core types."]

use lkjstr_relays::{LiveLeaseEffect, LiveLeaseState};

use crate::{FeedWindowState, QueryDemandPlan};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedRuntimeInput {
    pub runtime_id: String,
    pub generation: u64,
    pub max_items: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedRuntimeState {
    pub runtime_id: String,
    pub window: FeedWindowState,
    pub live_fingerprint: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedRuntimeLiveOutcome {
    pub runtime: FeedRuntimeState,
    pub leases: LiveLeaseState,
    pub plan: QueryDemandPlan,
    pub effects: Vec<LiveLeaseEffect>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedRuntimeLeaseOutcome {
    pub runtime: FeedRuntimeState,
    pub leases: LiveLeaseState,
    pub effects: Vec<LiveLeaseEffect>,
}
