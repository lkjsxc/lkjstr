//! Bounded retry buffer. Failed transactions leave their events pending.
use lkjstr_protocol::NostrEvent;
use std::collections::{HashSet, VecDeque};

/// At most 20,000 queued events plus one 500-event transaction snapshot.
#[derive(Default)]
pub struct PendingEvents {
    events: VecDeque<NostrEvent>,
    policy: usize,
}
const CAP: usize = 20_000;
const BATCH: usize = 500;
fn policy(event: &NostrEvent) -> bool {
    matches!(event.kind, 0 | 3 | 5 | 10000..=19999)
}
impl PendingEvents {
    pub fn push(&mut self, event: NostrEvent, storage_open: bool) {
        if !storage_open {
            return;
        }
        if self.events.len() == CAP
            && let Some(old) = self.events.pop_front()
        {
            self.policy = self.policy.saturating_sub(usize::from(policy(&old)));
        }
        self.policy += usize::from(policy(&event));
        self.events.push_back(event);
    }
    pub fn batch(&self) -> Vec<NostrEvent> {
        self.events.iter().take(BATCH).cloned().collect()
    }
    pub fn committed(&mut self, batch: &[NostrEvent]) {
        let ids: HashSet<_> = batch.iter().map(|event| &event.id).collect();
        self.events.retain(|event| {
            if !ids.contains(&event.id) {
                return true;
            }
            self.policy = self.policy.saturating_sub(usize::from(policy(event)));
            false
        });
    }
    /// Reply presentation can depend on public mute policy. A snapshot must not
    /// capture that new count until its policy event/deletion has committed.
    pub fn public_policy_pending(&self) -> bool {
        self.policy != 0
    }
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
    pub fn len(&self) -> usize {
        self.events.len()
    }
}
