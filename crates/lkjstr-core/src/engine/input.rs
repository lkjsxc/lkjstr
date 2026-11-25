//! Engine input dispatch, separate from bounded ingestion.
use super::*;
impl Engine {
    pub(super) fn error(&mut self, req: Option<String>, code: &str) {
        self.outgoing.push(Output::Error {
            req,
            code: code.into(),
        });
    }

    pub fn input(&mut self, input: Input, now: u64) {
        self.advance_visibility_clock(now);
        match input {
            Input::Open { sub, query } => self.open_view(sub, query, true, now),
            Input::OpenVisible {
                sub,
                query,
                visible,
            } => self.open_view(sub, query, visible, now),
            Input::Close { sub } => {
                self.release_cache_references(&sub);
                self.release_local_read_owner(&sub, now);
                self.views.remove(&sub);
                self.replan(now);
            }
            Input::Window {
                sub,
                anchor,
                before,
                after,
            }
            | Input::WindowAtMonth {
                sub,
                anchor,
                before,
                after,
                ..
            } => {
                self.set_window(&sub, anchor, before, after, now);
            }
            Input::FollowHead {
                sub,
                through,
                after,
            } => {
                if let Some(v) = self.views.get_mut(&sub) {
                    v.anchor = None;
                    v.before = 0;
                    v.after = after.min(windows::HEAD_ROWS - 1);
                    v.head_through = Some(through);
                    v.time_window = None;
                    self.advance_history(&sub);
                    self.replan(now);
                    self.render(&sub, true);
                }
            }
            Input::WindowAtTime {
                sub,
                at,
                before,
                after,
            } => {
                self.window_at_time(&sub, at, before, after, now);
            }
            Input::CacheRead { sub, ids } => self.cache_read(&sub, &ids, now),
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
                if self.signed_out_global_filter != enabled {
                    self.signed_out_global_filter = enabled;
                    self.replan(now);
                }
                let subs: Vec<_> = self.views.keys().cloned().collect();
                for sub in subs {
                    self.render(&sub, true);
                }
            }
            Input::Configure { relays } => {
                self.network.configure(relays, now);
                self.replan(now);
            }
            Input::OptimizerHint(interaction) => {
                self.network.optimizer.interaction = interaction;
                self.network.optimizer.hinted_at = now;
            }
            Input::Hint {
                visible_subs,
                focused_sub,
                page_hidden,
                save_data,
                ..
            } => {
                self.discovery_paused = page_hidden;
                self.network.optimizer.hidden = page_hidden;
                self.network.optimizer.save_data = save_data;
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
            Input::Signed { req, event, error } => {
                self.accept_signature(req, event, error, now, || {});
            }
        }
    }

    fn set_window(
        &mut self,
        sub: &str,
        anchor: Option<String>,
        before: usize,
        after: usize,
        now: u64,
    ) {
        let account = self.views.get(sub).and_then(|v| v.query.account.as_deref());
        let anchor = anchor.filter(|key| self.accepts_private_anchor(account, key));
        if let Some(v) = self.views.get_mut(sub) {
            v.anchor = anchor;
            v.head_through = None;
            v.time_window = None;
            v.before = before.min(6000);
            v.after = after.min(800);
            self.advance_history(sub);
            self.replan(now);
            self.render(sub, true);
        }
    }
}
