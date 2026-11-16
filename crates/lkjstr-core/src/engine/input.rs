//! Engine input dispatch, separate from bounded ingestion.
use super::*;
impl Engine {
    pub fn input(&mut self, input: Input, now: u64) {
        match input {
            Input::Open { sub, query } => {
                self.discovery_paused = false;
                if self.views.len() >= 128 && !self.views.contains_key(&sub) {
                    self.error(Some(sub), "subscription-limit");
                    return;
                }
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
                        visible: true,
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
            Input::Close { sub } => {
                self.views.remove(&sub);
                self.replan(now);
            }
            Input::Window {
                sub,
                anchor,
                before,
                after,
            } => {
                let account = self
                    .views
                    .get(&sub)
                    .and_then(|v| v.query.account.as_deref());
                let anchor = anchor.filter(|key| self.accepts_private_anchor(account, key));
                if let Some(v) = self.views.get_mut(&sub) {
                    v.anchor = anchor;
                    v.before = before.min(6000);
                    v.after = after.min(800);
                    self.advance_history(&sub);
                    self.replan(now);
                    self.render(&sub, true);
                }
            }
            Input::Reading { sub, id } => {
                let Some(view) = self.views.get(&sub) else {
                    return;
                };
                if id.as_ref().is_some_and(|id| {
                    id.len() > 256
                        || !view
                            .rows
                            .iter()
                            .any(|r| super::zap_visible::matches_anchor(&self.store, r, id, view))
                }) {
                    return;
                }
                if let Some(view) = self.views.get_mut(&sub) {
                    view.reading = id;
                }
            }
            Input::GlobalPolicy { enabled } => {
                self.signed_out_global_filter = enabled;
                let subs: Vec<_> = self.views.keys().cloned().collect();
                for sub in subs {
                    self.render(&sub, true);
                }
            }
            Input::Configure { relays } => {
                self.network.configure(relays, now);
                self.replan(now);
            }
            Input::Hint {
                visible_subs,
                focused_sub,
                page_hidden,
                ..
            } => {
                self.discovery_paused = page_hidden;
                self.network.focused_sub =
                    focused_sub.filter(|s| !page_hidden && visible_subs.contains(s));
                for (id, v) in &mut self.views {
                    v.visible = !page_hidden && visible_subs.contains(id);
                }
                self.replan(now);
            }
            Input::DeliveryWatch { reqs } => self.network.watch_deliveries(reqs),
            Input::Action {
                req,
                account,
                action,
            } => self.action(req, account, action, now),
            Input::Signed { req, event, .. } => self.signed(req, event, now),
        }
    }
}
