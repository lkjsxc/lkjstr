//! At most one speculative older page per visible view, within one buffer of its end.
use super::{
    Engine,
    protocol::{Query, Source},
};
use lkjstr_protocol::NostrFilter;
const PREFETCH_BUFFER_ROWS: usize = 60;
impl Engine {
    pub(super) fn nearby_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        let mut wants = Vec::new();
        for (sub, view) in self.views.iter().filter(|(_, view)| view.visible) {
            if !matches!(
                view.query.source,
                Source::Home
                    | Source::TheirHome
                    | Source::Global
                    | Source::Profile
                    | Source::Hashtag
                    | Source::Notifications
                    | Source::Thread
            ) {
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
            let mut older = head.clone();
            older.until = Some(until);
            if &older != active {
                wants.push((format!("~prefetch:{sub}"), older, view.query.clone()));
            }
        }
        wants
    }
}
