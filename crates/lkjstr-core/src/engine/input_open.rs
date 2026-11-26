use super::*;
impl Engine {
    pub(super) fn open_view(&mut self, sub: String, query: Query, visible: bool, now: u64) {
        self.discovery_paused = false;
        if self.views.len() >= 128 && !self.views.contains_key(&sub) {
            self.error(Some(sub), "subscription-limit");
            return;
        }
        self.release_cache_references(&sub);
        self.release_local_read_owner(&sub, now);
        self.network.reset_observation(&sub);
        self.outgoing
            .retain(|out| !matches!(out, Output::Status { sub: old, .. } | Output::TimeWindow { sub: old, .. } if old == &sub));
        self.metrics.served_from_cache +=
            super::list_events::events(&self.store, &query, &self.private_lists)
                .len()
                .min(50) as u64;
        self.views.insert(
            sub.clone(),
            View {
                query,
                anchor: None,
                time_window: None,
                reading: None,
                head_through: None,
                before: 0,
                after: 50,
                rows: vec![],
                opened_at: now,
                opened_after: self.delivery_sequence,
                invalid_deliveries: 0,
                visible,
                dirty: true,
                history: None,
                notification_history: None,
                history_horizon: None,
                oldest_history_shown: None,
                at_bottom: false,
                source_exhausted: false,
            },
        );
        self.replan(now);
        self.render(&sub, true);
    }
}
