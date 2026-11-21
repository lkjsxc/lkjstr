//! Historical fetches retain one page per view alongside the live head.
use super::{Engine, View, network::Network, protocol::Source, query, windows};
use crate::store::Store;

fn paged(v: &View) -> bool {
    matches!(
        v.query.source,
        Source::Thread
            | Source::Followers
            | Source::Channel
            | Source::Global
            | Source::Home
            | Source::TheirHome
            | Source::Profile
            | Source::Search
            | Source::Hashtag
            | Source::Relay
            | Source::Notifications
    )
}
pub(super) fn notification_filter(
    store: &Store,
    q: &super::Query,
) -> Option<lkjstr_protocol::NostrFilter> {
    if q.filters.notifications != Some(true)
        || !matches!(q.source, Source::Home | Source::Global | Source::TheirHome)
    {
        return None;
    }
    let mut news = q.clone();
    news.source = Source::Notifications;
    Some(query::filter(store, &news))
}
pub(super) fn exhausted(network: &Network, store: &Store, v: &View) -> bool {
    query::signed_out(&v.query)
        || !paged(v)
        || (!network.verifying
            && network.page_exhausted(
                v.history
                    .as_ref()
                    .unwrap_or(&query::filter(store, &v.query)),
            )
            && notification_filter(store, &v.query).is_none_or(|f| {
                network.page_exhausted(v.notification_history.as_ref().unwrap_or(&f))
            }))
}
impl Engine {
    pub(super) fn advance_history(&mut self, sub: &str) -> bool {
        if self.network.verifying {
            return false;
        }
        let Some(v) = self.views.get_mut(sub) else {
            return false;
        };
        if !v.visible || !paged(v) || exhausted(&self.network, &self.store, v) {
            return false;
        }
        let events = super::list_events::events(&self.store, &v.query, &self.private_lists);
        if windows::selection(
            &self.store,
            &self.network,
            v,
            self.signed_out_global_filter,
            &events,
            &self.private_lists,
        )
        .raw
        .end < events.len()
        {
            return false;
        }
        let mut changed = false;
        if let Some(mut head) = notification_filter(&self.store, &v.query) {
            let active = v.notification_history.as_ref().unwrap_or(&head);
            if self.network.page_finished(active)
                && !self.network.page_exhausted(active)
                && let Some(until) = self.network.page_cursor(active)
            {
                head.until = Some(until);
                if v.notification_history.as_ref() != Some(&head) {
                    v.notification_history = Some(head);
                    changed = true;
                }
            }
        }
        let head = query::filter(&self.store, &v.query);
        let active = v.history.as_ref().unwrap_or(&head);
        if !self.network.page_finished(active) || self.network.page_exhausted(active) {
            return changed;
        }
        let Some(until) = self
            .network
            .page_cursor(active)
            .or_else(|| events.last().map(|e| e.created_at))
        else {
            return changed;
        };
        let mut page = head;
        // Inclusive boundary avoids silently dropping tied timestamps. A full,
        // nonadvancing page remains unknown rather than claiming exhaustion.
        page.until = Some(until);
        if v.history.as_ref() == Some(&page) {
            return changed;
        }
        v.history = Some(page);
        true
    }
}

impl Engine {
    /// Refill incomplete windows after EOSE, including inclusive timestamp overlap.
    pub(super) fn refill_history(&mut self, now: u64) {
        if self.network.verifying {
            return;
        }
        let subs: Vec<_> = self
            .views
            .iter()
            .filter(|(_, v)| {
                v.visible
                    && paged(v)
                    && !exhausted(&self.network, &self.store, v)
                    && self.network.page_finished(
                        v.history
                            .as_ref()
                            .unwrap_or(&query::filter(&self.store, &v.query)),
                    )
            })
            .filter_map(|(sub, v)| {
                let events = super::list_events::events(&self.store, &v.query, &self.private_lists);
                let selected = windows::selection(
                    &self.store,
                    &self.network,
                    v,
                    self.signed_out_global_filter,
                    &events,
                    &self.private_lists,
                );
                let at = v
                    .anchor
                    .as_ref()
                    .and_then(|id| {
                        events
                            .iter()
                            .position(|e| super::rich::anchored(&self.store, e, id, &v.query))
                    })
                    .unwrap_or(0);
                let needed = at
                    .saturating_add(v.after)
                    .saturating_add(1)
                    .min(windows::HEAD_ROWS);
                let filtered = selected.held.iter().any(Option::is_some)
                    && selected.held.iter().filter(|h| h.is_none()).count() < selected.quota;
                (selected.raw.end == events.len() && (events.len() < needed || filtered))
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
