//! Bounded retry buffer. Failed transactions leave their events pending.
use lkjstr_protocol::NostrEvent;
use std::collections::{HashSet, VecDeque};

/// At most 20,000 queued events plus one 500-event transaction snapshot.
#[derive(Default)]
pub struct PendingEvents(VecDeque<NostrEvent>);
const CAP: usize = 20_000;
const BATCH: usize = 500;

impl PendingEvents {
    pub fn push(&mut self, event: NostrEvent, storage_open: bool) {
        if !storage_open {
            return;
        }
        if self.0.len() == CAP {
            self.0.pop_front();
        }
        self.0.push_back(event);
    }
    pub fn batch(&self) -> Vec<NostrEvent> {
        self.0.iter().take(BATCH).cloned().collect()
    }
    pub fn committed(&mut self, batch: &[NostrEvent]) {
        let ids: HashSet<_> = batch.iter().map(|e| &e.id).collect();
        self.0.retain(|e| !ids.contains(&e.id));
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
    pub fn len(&self) -> usize {
        self.0.len()
    }
}
