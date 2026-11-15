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
    pub(super) fn advance_history(&mut self, sub: &str) -> bool {
        let Some(v) = self.views.get_mut(sub) else {
            return false;
        };
        if !v.visible || !paged(v) || exhausted(&self.network, &self.store, v) {
            return false;
        }
        let events = query::events(&self.store, &v.query);
        if windows::selection(
            &self.store,
            &self.network,
            v,
            self.signed_out_global_filter,
            &events,
        )
        .0
        .end < events.len()
        {
            return false;
        }
        let head = query::filter(&self.store, &v.query);
        let active = v.history.as_ref().unwrap_or(&head);
        if !self.network.page_finished(active) {
            return false;
        }
        let Some(until) = self
            .network
            .page_cursor(active)
            .or_else(|| events.last().map(|e| e.created_at))
        else {
            return false;
        };
        let mut page = head;
        // Inclusive boundary avoids silently dropping tied timestamps. A full,
        // nonadvancing page remains unknown rather than claiming exhaustion.
        page.until = Some(until);
        if v.history.as_ref() == Some(&page) {
            return false;
        }
        v.history = Some(page);
        true
    }
}

impl Engine {
    /// Empty filtered windows have no frontend anchor to request more history.
    pub(super) fn refill_history(&mut self, now: u64) {
        if !self.signed_out_global_filter {
            return;
        }
        let subs: Vec<_> = self
            .views
            .iter()
            .filter(|(_, v)| {
                v.visible
                    && v.query.account.is_none()
                    && v.query.source == Source::Global
                    && !exhausted(&self.network, &self.store, v)
                    && self.network.page_finished(
                        v.history
                            .as_ref()
                            .unwrap_or(&query::filter(&self.store, &v.query)),
                    )
            })
            .filter_map(|(sub, v)| {
                let events = query::events(&self.store, &v.query);
                let (raw, held) = windows::selection(&self.store, &self.network, v, true, &events);
                (raw.end == events.len()
                    && held.iter().filter(|h| h.is_none()).count()
                        < windows::range(v, &events).len())
                .then(|| sub.clone())
            })
            .collect();
        let mut changed = false;
        for sub in subs {
            changed |= self.advance_history(&sub);
        }
        if changed {
            self.replan(now);
        }
    }
}
