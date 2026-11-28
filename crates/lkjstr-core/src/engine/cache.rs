//! Restore checked cache receipts before opening views; legacy rows still verify.
#[path = "cache_context_runtime.rs"]
mod context_runtime;
#[path = "cache_context_state.rs"]
mod context_state;
#[path = "cache_reference_wants.rs"]
mod references;
use super::*;
use crate::cache::{Record, Restored, VERIFY_SOURCE};
pub use context_state::{ContextBatch, ContextEvidence, ReadContexts};

impl Engine {
    pub(super) fn insert_verified(
        &mut self,
        event: NostrEvent,
        relay: Option<&str>,
    ) -> crate::store::Inserted {
        self.read_contexts.changed(&event);
        self.store.insert_deferred(event, relay)
    }
    pub fn restore_cache(&mut self, records: &[Record]) {
        let revision = self.store.revision();
        let evictions = self.store.evictions();
        let dropped = self.dropped;
        for (index, record) in records.iter().enumerate() {
            if index != 0 && index.is_multiple_of(64) {
                self.trim_store();
            }
            match record.restore() {
                Ok(Restored::Verified(event)) => {
                    let policy =
                        (event.kind == 10000).then(|| (event.pubkey.clone(), event.id.clone()));
                    if self.store.lease(&event.id).is_none() {
                        // Embedded repost targets are not separately receipted records.
                        if let Some(nested) = lkjstr_protocol::verified_nested_repost(&event) {
                            self.insert_verified(nested, Some("cache"));
                        }
                        let observation = self
                            .network
                            .observe_cache_resource(&event, self.network.now);
                        let bytes = crate::store::event_payload_bytes(&event) as u64;
                        let outcome = self.insert_verified(event, Some("cache"));
                        let admitted = matches!(
                            outcome,
                            crate::store::Inserted::New | crate::store::Inserted::Replaced
                        );
                        self.network.observed_receipt(
                            observation,
                            if admitted {
                                fetch_records::Outcome::Ok
                            } else {
                                fetch_records::Outcome::Rejected
                            },
                            Some(if admitted { bytes } else { 0 }),
                            admitted,
                        );
                    }
                    if let Some((author, id)) = policy {
                        self.read_contexts
                            .policy_committed(&self.store, &author, &id);
                    }
                }
                Ok(Restored::Verify(event)) => {
                    self.cached_history_complete = false;
                    self.enqueue(VERIFY_SOURCE.into(), event);
                }
                Err(_) => self.cached_history_complete = false,
            }
        }
        self.trim_store();
        self.cached_history_complete &=
            self.dropped == dropped && self.store.evictions() == evictions;
        if self.store.revision() != revision {
            self.network.profiles_changed = true;
            for view in self.views.values_mut() {
                view.dirty = true;
            }
        }
    }
}
