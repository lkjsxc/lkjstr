#![doc = "Live lease reducer effect helpers."]

use crate::lease_key_from_fingerprint;

use super::{LiveLeaseEffect, LiveLeaseEffectKind, LiveLeaseOutcome, LiveLeaseState};

impl LiveLeaseState {
    pub(super) fn open(
        &mut self,
        fingerprint: String,
        lease_key: String,
        kind: LiveLeaseEffectKind,
        outcome: &mut LiveLeaseOutcome,
    ) {
        if self.open_leases.insert(fingerprint.clone()) {
            self.relay_req_total = self.relay_req_total.saturating_add(1);
            outcome.effects.push(LiveLeaseEffect {
                kind,
                fingerprint,
                lease_key,
            });
        }
    }

    pub(super) fn close(
        &mut self,
        fingerprint: &str,
        kind: LiveLeaseEffectKind,
        outcome: &mut LiveLeaseOutcome,
    ) {
        if self.open_leases.remove(fingerprint) {
            self.relay_close_total = self.relay_close_total.saturating_add(1);
            outcome.effects.push(LiveLeaseEffect {
                kind,
                fingerprint: fingerprint.to_owned(),
                lease_key: lease_key_from_fingerprint(fingerprint),
            });
        }
    }
}
