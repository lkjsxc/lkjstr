use super::*;
impl Engine {
    pub(super) fn open_view(
        &mut self,
        sub: String,
        query: Query,
        visible: bool,
        window: Option<protocol::InitialWindow>,
        now: u64,
    ) {
        if self.views.len() >= 128 && !self.views.contains_key(&sub) {
            self.error(Some(sub), "subscription-limit");
            return;
        }
        self.release_cache_references(&sub);
        self.release_local_read_owner(&sub, now);
        self.network.reset_observation(&sub);
        self.outgoing
            .retain(|out| !matches!(out, Output::Status { sub: old, .. } | Output::TimeWindow { sub: old, .. } if old == &sub));
        let restored = window.is_some();
        let (anchor, before, after) = window.map_or((None, 0, 50), |window| {
            let anchor = window
                .anchor
                .filter(|key| self.accepts_private_anchor(query.account.as_deref(), key));
            (anchor, window.before.min(6000), window.after.min(800))
        });
        self.views.insert(
            sub.clone(),
            View {
                query,
                anchor,
                time_window: None,
                reading: None,
                head_through: None,
                before,
                after,
                rows: vec![],
                opened_at: now,
                opened_after: self.delivery_sequence,
                invalid_deliveries: 0,
                visible,
                dirty: true,
                history: None,
                notification_history: None,
                history_horizon: None,
                history_scope: None,
                at_bottom: false,
                source_exhausted: false,
            },
        );
        if restored {
            self.advance_history(&sub);
        }
        self.replan(now);
        self.render(&sub, true);
        if let Some(view) = self.views.get(&sub) {
            self.metrics.served_from_cache += view.rows.len().min(50) as u64;
        }
    }
}
