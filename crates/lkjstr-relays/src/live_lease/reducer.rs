#![doc = "Pure live lease host-effect reducer."]

use std::collections::BTreeSet;

use crate::{
    Demand, DemandAttachAction, DemandDetachAction, DemandLeaseRegistry, DemandSurface,
    DemandVisibility, DemandVisibilityAction, IngressDecision, ingress_decision,
};

use super::{LiveIngressOutcome, LiveLeaseCounts, LiveLeaseEffectKind, LiveLeaseOutcome};

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct LiveLeaseState {
    pub(super) registry: DemandLeaseRegistry,
    pub(super) open_leases: BTreeSet<String>,
    pub(super) relay_req_total: u64,
    pub(super) relay_close_total: u64,
    pub(super) events_received: u64,
    pub(super) events_accepted: u64,
    pub(super) events_dropped_non_render_critical: u64,
}

impl LiveLeaseState {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn attach(&mut self, demand: Demand, now_sec: u64) -> LiveLeaseOutcome {
        let attached = self.registry.attach(demand, now_sec);
        let mut outcome = LiveLeaseOutcome {
            effects: Vec::new(),
            snapshot: Some(attached.snapshot.clone()),
        };
        if attached.action == DemandAttachAction::Start {
            self.open(
                attached.snapshot.fingerprint,
                attached.snapshot.lease_key,
                LiveLeaseEffectKind::OpenWire,
                &mut outcome,
            );
        }
        outcome
    }

    pub fn release(&mut self, owner: &str, fingerprint: &str) -> LiveLeaseOutcome {
        let released = self.registry.release(owner, fingerprint);
        let mut outcome = LiveLeaseOutcome {
            effects: Vec::new(),
            snapshot: released.snapshot,
        };
        if released.action == DemandDetachAction::Close {
            self.close(fingerprint, LiveLeaseEffectKind::CloseWire, &mut outcome);
        }
        outcome
    }

    pub fn set_owner_visibility(
        &mut self,
        owner: &str,
        visibility: DemandVisibility,
    ) -> LiveLeaseOutcome {
        let changes = self.registry.set_owner_visibility(owner, visibility);
        let mut outcome = LiveLeaseOutcome::default();
        for change in changes {
            outcome.snapshot = Some(change.snapshot.clone());
            match change.action {
                DemandVisibilityAction::Suspend => {
                    self.close(
                        &change.snapshot.fingerprint,
                        LiveLeaseEffectKind::SuspendWire,
                        &mut outcome,
                    );
                }
                DemandVisibilityAction::Resume => {
                    self.open(
                        change.snapshot.fingerprint,
                        change.snapshot.lease_key,
                        LiveLeaseEffectKind::ResumeWire,
                        &mut outcome,
                    );
                }
                DemandVisibilityAction::Keep => {}
            }
        }
        outcome
    }

    pub fn classify_ingress(&mut self, surface: DemandSurface, kind: u64) -> LiveIngressOutcome {
        self.events_received = self.events_received.saturating_add(1);
        let decision = ingress_decision(surface, kind);
        match decision {
            IngressDecision::Accept => {
                self.events_accepted = self.events_accepted.saturating_add(1);
            }
            IngressDecision::DropNonRenderCritical => {
                self.events_dropped_non_render_critical =
                    self.events_dropped_non_render_critical.saturating_add(1);
            }
        }
        LiveIngressOutcome {
            decision,
            counts: self.counts(),
        }
    }

    #[must_use]
    pub fn counts(&self) -> LiveLeaseCounts {
        let registry = self.registry.counts();
        LiveLeaseCounts {
            active_demands: registry.active_demands,
            active_leases: registry.active_leases,
            visible_owners: registry.visible_owners,
            open_live_leases: self.open_leases.len(),
            relay_req_total: self.relay_req_total,
            relay_close_total: self.relay_close_total,
            events_received: self.events_received,
            events_accepted: self.events_accepted,
            events_dropped_non_render_critical: self.events_dropped_non_render_critical,
        }
    }
}
