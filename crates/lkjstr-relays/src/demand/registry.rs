#![doc = "Pure lease owner and visibility registry."]

use std::collections::{BTreeMap, BTreeSet};

use super::{Demand, DemandVisibility, wire_equivalent_fingerprint};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandAttachAction {
    Start,
    Share,
    RegisterHidden,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandDetachAction {
    Keep,
    Close,
    Missing,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandVisibilityAction {
    Keep,
    Suspend,
    Resume,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DemandLeaseSnapshot {
    pub fingerprint: String,
    pub lease_key: String,
    pub owner_count: usize,
    pub visible_owner_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DemandAttachOutcome {
    pub action: DemandAttachAction,
    pub snapshot: DemandLeaseSnapshot,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DemandDetachOutcome {
    pub action: DemandDetachAction,
    pub snapshot: Option<DemandLeaseSnapshot>,
}

impl DemandDetachOutcome {
    fn missing() -> Self {
        Self {
            action: DemandDetachAction::Missing,
            snapshot: None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DemandVisibilityOutcome {
    pub action: DemandVisibilityAction,
    pub snapshot: DemandLeaseSnapshot,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct DemandRegistryCounts {
    pub active_demands: usize,
    pub active_leases: usize,
    pub visible_owners: usize,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct DemandLeaseRegistry {
    pub(super) leases: BTreeMap<String, BTreeMap<String, Demand>>,
    pub(super) owner_index: BTreeMap<String, BTreeSet<String>>,
}

impl DemandLeaseRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn attach(&mut self, demand: Demand, now_sec: u64) -> DemandAttachOutcome {
        let fingerprint = wire_equivalent_fingerprint(&demand, now_sec);
        let previous_visible = self.visible_owner_count(&fingerprint);
        let owner = demand.owner.clone();
        self.leases
            .entry(fingerprint.clone())
            .or_default()
            .insert(owner.clone(), demand.clone());
        self.owner_index
            .entry(owner)
            .or_default()
            .insert(fingerprint.clone());
        let snapshot = self.snapshot(&fingerprint);
        DemandAttachOutcome {
            action: attach_action(demand.visibility, previous_visible),
            snapshot,
        }
    }

    pub fn release(&mut self, owner: &str, fingerprint: &str) -> DemandDetachOutcome {
        let previous_visible = self.visible_owner_count(fingerprint);
        let Some(owners) = self.leases.get_mut(fingerprint) else {
            return DemandDetachOutcome::missing();
        };
        if owners.remove(owner).is_none() {
            return DemandDetachOutcome::missing();
        }
        self.remove_owner_index(owner, fingerprint);
        let snapshot = self.snapshot_if_present(fingerprint);
        let visible_after = snapshot.as_ref().map_or(0, |item| item.visible_owner_count);
        if snapshot.is_none() {
            self.leases.remove(fingerprint);
        }
        DemandDetachOutcome {
            action: detach_action(previous_visible, visible_after),
            snapshot,
        }
    }

    pub fn set_owner_visibility(
        &mut self,
        owner: &str,
        visibility: DemandVisibility,
    ) -> Vec<DemandVisibilityOutcome> {
        let fingerprints = self.fingerprints_for_owner(owner);
        fingerprints
            .iter()
            .filter_map(|fingerprint| self.set_visibility(owner, fingerprint, visibility))
            .collect()
    }

    #[must_use]
    pub fn fingerprints_for_owner(&self, owner: &str) -> Vec<String> {
        self.owner_index
            .get(owner)
            .map_or_else(Vec::new, |items| items.iter().cloned().collect())
    }

    #[must_use]
    pub fn counts(&self) -> DemandRegistryCounts {
        self.leases
            .values()
            .fold(DemandRegistryCounts::default(), |mut counts, owners| {
                counts.active_leases += usize::from(!owners.is_empty());
                counts.active_demands += owners.len();
                counts.visible_owners += owners
                    .values()
                    .filter(|demand| demand.visibility == DemandVisibility::Visible)
                    .count();
                counts
            })
    }
}

fn attach_action(visibility: DemandVisibility, previous_visible: usize) -> DemandAttachAction {
    match (visibility, previous_visible) {
        (DemandVisibility::Hidden, _) => DemandAttachAction::RegisterHidden,
        (DemandVisibility::Visible, 0) => DemandAttachAction::Start,
        (DemandVisibility::Visible, _) => DemandAttachAction::Share,
    }
}

fn detach_action(previous_visible: usize, visible_after: usize) -> DemandDetachAction {
    if previous_visible > 0 && visible_after == 0 {
        DemandDetachAction::Close
    } else {
        DemandDetachAction::Keep
    }
}
