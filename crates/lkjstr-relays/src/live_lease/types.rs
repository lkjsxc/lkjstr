#![doc = "Live lease effect and counter types."]

use crate::{DemandLeaseSnapshot, IngressDecision};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LiveLeaseEffectKind {
    OpenWire,
    CloseWire,
    SuspendWire,
    ResumeWire,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiveLeaseEffect {
    pub kind: LiveLeaseEffectKind,
    pub fingerprint: String,
    pub lease_key: String,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct LiveLeaseOutcome {
    pub effects: Vec<LiveLeaseEffect>,
    pub snapshot: Option<DemandLeaseSnapshot>,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct LiveLeaseCounts {
    pub active_demands: usize,
    pub active_leases: usize,
    pub visible_owners: usize,
    pub open_live_leases: usize,
    pub relay_req_total: u64,
    pub relay_close_total: u64,
    pub events_received: u64,
    pub events_accepted: u64,
    pub events_dropped_non_render_critical: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LiveIngressOutcome {
    pub decision: IngressDecision,
    pub counts: LiveLeaseCounts,
}
