#![doc = "Demand registry private helpers."]

use super::{
    DemandLeaseRegistry, DemandLeaseSnapshot, DemandVisibility, DemandVisibilityAction,
    DemandVisibilityOutcome, lease_key_from_fingerprint,
};

impl DemandLeaseRegistry {
    pub(super) fn snapshot(&self, fingerprint: &str) -> DemandLeaseSnapshot {
        match self.snapshot_if_present(fingerprint) {
            Some(snapshot) => snapshot,
            None => DemandLeaseSnapshot {
                fingerprint: fingerprint.to_owned(),
                lease_key: lease_key_from_fingerprint(fingerprint),
                owner_count: 0,
                visible_owner_count: 0,
            },
        }
    }

    pub(super) fn snapshot_if_present(&self, fingerprint: &str) -> Option<DemandLeaseSnapshot> {
        let owners = self.leases.get(fingerprint)?;
        if owners.is_empty() {
            return None;
        }
        Some(DemandLeaseSnapshot {
            fingerprint: fingerprint.to_owned(),
            lease_key: lease_key_from_fingerprint(fingerprint),
            owner_count: owners.len(),
            visible_owner_count: self.visible_owner_count(fingerprint),
        })
    }

    pub(super) fn visible_owner_count(&self, fingerprint: &str) -> usize {
        self.leases.get(fingerprint).map_or(0, |owners| {
            owners
                .values()
                .filter(|demand| demand.visibility == DemandVisibility::Visible)
                .count()
        })
    }

    pub(super) fn remove_owner_index(&mut self, owner: &str, fingerprint: &str) {
        if let Some(fingerprints) = self.owner_index.get_mut(owner) {
            fingerprints.remove(fingerprint);
            if fingerprints.is_empty() {
                self.owner_index.remove(owner);
            }
        }
    }

    pub(super) fn set_visibility(
        &mut self,
        owner: &str,
        fingerprint: &str,
        visibility: DemandVisibility,
    ) -> Option<DemandVisibilityOutcome> {
        let previous_visible = self.visible_owner_count(fingerprint);
        let owners = self.leases.get_mut(fingerprint)?;
        let demand = owners.get_mut(owner)?;
        demand.visibility = visibility;
        let snapshot = self.snapshot(fingerprint);
        Some(DemandVisibilityOutcome {
            action: visibility_action(previous_visible, snapshot.visible_owner_count),
            snapshot,
        })
    }
}

fn visibility_action(previous_visible: usize, visible_after: usize) -> DemandVisibilityAction {
    match (previous_visible, visible_after) {
        (0, after) if after > 0 => DemandVisibilityAction::Resume,
        (before, 0) if before > 0 => DemandVisibilityAction::Suspend,
        _ => DemandVisibilityAction::Keep,
    }
}
