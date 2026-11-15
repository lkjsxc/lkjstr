//! Historical fetches retain one page per view alongside the live head.
use super::{Engine, View, network::Network, protocol::Source, query, windows};
use crate::store::Store;

fn paged(v: &View) -> bool {
    matches!(
        v.query.source,
        Source::Global
            | Source::Home
            | Source::Profile
            | Source::Search
            | Source::Hashtag
            | Source::Relay
            | Source::Notifications
    )
}
pub(super) fn exhausted(network: &Network, store: &Store, v: &View) -> bool {
    query::signed_out(&v.query)
        || !paged(v)
        || network.page_exhausted(
            v.history
                .as_ref()
                .unwrap_or(&query::filter(store, &v.query)),
        )
}
impl Engine {
    pub(super) fn advance_history(&mut self, sub: &str) {
        let Some(v) = self.views.get_mut(sub) else {
            return;
        };
        if !v.visible || !paged(v) || exhausted(&self.network, &self.store, v) {
            return;
        }
        let events = query::events(&self.store, &v.query);
        if windows::range(v, &events).end < events.len() {
            return;
        }
        let head = query::filter(&self.store, &v.query);
        let active = v.history.as_ref().unwrap_or(&head);
        if !self.network.page_finished(active) {
            return;
        }
        let Some(until) = self
            .network
            .page_cursor(active)
            .or_else(|| events.last().map(|e| e.created_at))
        else {
            return;
        };
        let mut page = head;
        // Inclusive boundary avoids silently dropping tied timestamps. A full,
        // nonadvancing page remains unknown rather than claiming exhaustion.
        page.until = Some(until);
        v.history = Some(page);
    }
}
