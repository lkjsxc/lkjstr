//! Bounded speculative older pages near the end of a visible window.
use super::{
    Engine,
    protocol::{Query, Source},
};
use lkjstr_protocol::NostrFilter;
const PREFETCH_BUFFER_ROWS: usize = 60;
impl Engine {
    pub(super) fn nearby_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        let depth = self.network.prefetch_depth();
        if depth == 0 {
            return Vec::new();
        }
        let mut wants = Vec::new();
        for (sub, view) in self.views.iter().filter(|(_, view)| view.visible) {
            if view.time_window.is_some()
                || !matches!(
                    view.query.source,
                    Source::Home
                        | Source::TheirHome
                        | Source::Global
                        | Source::Profile
                        | Source::Hashtag
                        | Source::Notifications
                        | Source::Thread
                )
            {
                continue;
            }
            let head = super::query::filter(&self.store, &view.query);
            let active = view.history.as_ref().unwrap_or(&head);
            if !self.network.page_finished(active) || self.network.page_exhausted(active) {
                continue;
            }
            let Some(until) = self.network.page_cursor(active) else {
                continue;
            };
            let events = super::list_events::events(&self.store, &view.query, &self.private_lists);
            let selected = super::windows::selection(
                &self.store,
                &self.network,
                view,
                self.signed_out_global_filter,
                &events,
                &self.private_lists,
            );
            if events.is_empty()
                || selected.raw.end.saturating_add(PREFETCH_BUFFER_ROWS) < events.len()
            {
                continue;
            }
            let mut until = until;
            for _ in 0..depth {
                let mut older = head.clone();
                older.until = Some(until);
                if &older == active {
                    break;
                }
                wants.push((
                    format!("~prefetch:{sub}"),
                    older.clone(),
                    view.query.clone(),
                ));
                if !self.network.page_finished(&older) || self.network.page_exhausted(&older) {
                    break;
                }
                let Some(next) = self
                    .network
                    .page_cursor(&older)
                    .filter(|next| *next < until)
                else {
                    break;
                };
                until = next;
            }
        }
        wants
    }
}
