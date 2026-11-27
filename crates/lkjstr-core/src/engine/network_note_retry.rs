//! Schedule the next round without holding a relay slot during backoff.
use super::*;

impl NoteOutbox {
    pub(in crate::engine) fn due(&self, now: u64) -> Vec<NostrEvent> {
        self.entries
            .values()
            .filter(|e| e.status.phase == Phase::Retrying && now >= e.ready_at)
            .filter_map(|e| e.event.clone())
            .collect()
    }

    pub(in crate::engine) fn retry_routes(
        &mut self,
        id: &str,
        mut routes: Vec<Destination>,
        blocked: &BTreeSet<String>,
    ) -> Vec<Destination> {
        let Some(e) = self.entries.get_mut(id) else {
            return vec![];
        };
        if (e.restored && !e.routes.is_empty()) || routes.iter().all(|d| d.state != "pending") {
            routes.clone_from(&e.routes);
        }
        routes.retain(|d| {
            !blocked.contains(&d.url) && !e.hard.contains_key(&d.url) && d.state == "pending"
        });
        if !routes.is_empty() {
            e.routes.clone_from(&routes);
        }
        e.restored = false;
        e.ready_at = u64::MAX;
        e.status.attempts = e.status.attempts.saturating_add(1);
        self.revision += 1;
        e.dirty = self.revision;
        routes
    }

    pub(in crate::engine) fn ready(&mut self, relay: Option<&str>, now: u64) {
        for e in self
            .entries
            .values_mut()
            .filter(|e| e.status.phase == Phase::Retrying && e.ready_at != u64::MAX)
        {
            if relay.is_none_or(|url| {
                e.routes
                    .iter()
                    .any(|d| d.url == url && !e.hard.contains_key(url))
            }) {
                e.ready_at = e.ready_at.min(now);
            }
        }
    }
}
