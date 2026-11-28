//! Bounded ghost history for actual committed avatar-cache evictions.
use super::*;
impl Observer {
    /// A committed eviction, never a planned/aborted deletion. Only salted keys are retained.
    pub fn evicted(&self, class: ResourceClass, key: KeyHash) {
        self.edit(|l| {
            if l.ghost_keys.insert((class, key)) {
                if l.ghost_order.len() == MAX_RECORDS
                    && let Some(old) = l.ghost_order.pop_front()
                {
                    l.ghost_keys.remove(&old);
                }
                l.ghost_order.push_back((class, key));
            }
        });
    }
    pub fn refetched(&self, class: ResourceClass, identity: &str) {
        let Some(key) = self.key(identity) else {
            return;
        };
        self.edit(|l| {
            if l.ghost_keys.remove(&(class, key)) {
                l.ghost_order.retain(|v| *v != (class, key));
                let t = l.totals.entry(class).or_default();
                t.ghost_hits = t.ghost_hits.saturating_add(1);
            }
        });
    }
}
