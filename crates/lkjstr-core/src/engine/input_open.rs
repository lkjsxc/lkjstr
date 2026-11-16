use super::*;
impl Engine {
    pub(super) fn open_view(&mut self, sub: String, query: Query, visible: bool, now: u64) {
        self.discovery_paused = false;
        if self.views.len() >= 128 && !self.views.contains_key(&sub) {
            self.error(Some(sub), "subscription-limit");
            return;
        }
        self.network.reset_observation(&sub);
        self.outgoing
            .retain(|out| !matches!(out, Output::Status { sub: old, .. } if old == &sub));
        self.metrics.served_from_cache +=
            super::list_events::events(&self.store, &query, &self.private_lists)
                .len()
                .min(50) as u64;
        self.views.insert(
            sub.clone(),
            View {
                query,
                anchor: None,
                reading: None,
                before: 0,
                after: 50,
                rows: vec![],
                visible,
                dirty: true,
                history: None,
                notification_history: None,
                at_bottom: false,
                source_exhausted: false,
            },
        );
        self.render(&sub, true);
        self.replan(now);
    }
}
