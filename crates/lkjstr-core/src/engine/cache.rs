//! Restore checked cache receipts before opening views; legacy rows still verify.
use super::*;
use crate::cache::{Record, Restored, VERIFY_SOURCE};

impl Engine {
    pub fn restore_cache(&mut self, records: &[Record]) {
        let revision = self.store.revision();
        let evictions = self.store.evictions();
        let dropped = self.dropped;
        for record in records {
            match record.restore() {
                Ok(Restored::Verified(event)) => {
                    if self.store.get(&event.id).is_some() {
                        continue;
                    }
                    // Embedded repost targets are not separately receipted records.
                    if let Some(nested) = lkjstr_protocol::verified_nested_repost(&event) {
                        self.store.insert(nested, Some("cache"));
                    }
                    self.store.insert(event, Some("cache"));
                }
                Ok(Restored::Verify(event)) => {
                    self.cached_history_complete = false;
                    self.enqueue(VERIFY_SOURCE.into(), event);
                }
                Err(_) => self.cached_history_complete = false,
            }
        }
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
