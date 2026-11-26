//! Apply route coverage to merged chronological query answers.
use super::{Engine, View, network::Network, protocol::Source, query};
use crate::store::Store;

pub(super) fn merged(v: &View) -> bool {
    v.time_window.is_none()
        && matches!(
            v.query.source,
            Source::Home
                | Source::TheirHome
                | Source::Global
                | Source::Hashtag
                | Source::Search
                | Source::Channel
                | Source::Notifications
        )
}

fn horizon(network: &Network, store: &Store, sub: &str, v: &View) -> Option<u64> {
    if !merged(v) || query::signed_out(&v.query) {
        return None;
    }
    let q = &v.query;
    let owner = match q.source {
        Source::Home => q.account.as_deref(),
        Source::TheirHome => q.target.as_deref(),
        _ => None,
    };
    let following = owner.filter(|owner| {
        store.replaceable(owner, 3).is_none() && network.waiting_for_follows(store, sub, owner)
    });
    let head = query::filter(store, q);
    let chronological = network.history_horizon(store, sub, head, v.history.as_ref());
    let notifications = super::history::notification_filter(store, q).and_then(|head| {
        network.history_horizon(store, sub, head, v.notification_history.as_ref())
    });
    chronological
        .max(notifications)
        .max(following.map(|_| v.opened_at / 1000))
}

pub(super) fn bounded_query(
    q: &super::Query,
    horizon: Option<u64>,
) -> std::borrow::Cow<'_, super::Query> {
    if let Some(at) = horizon {
        let mut q = q.clone();
        q.filters.since = Some(q.filters.since.unwrap_or(0).max(at));
        return std::borrow::Cow::Owned(q);
    }
    std::borrow::Cow::Borrowed(q)
}

pub(super) fn holds_anchor(store: &Store, view: &View, id: &str) -> bool {
    view.history_horizon
        .is_some_and(|at| store.lease(id).is_some_and(|note| note.order.0 < at))
}

impl Engine {
    pub(super) fn refresh_history_horizons(&mut self) {
        for (sub, v) in self.views.iter_mut().filter(|(_, v)| v.visible) {
            let next = horizon(&self.network, &self.store, sub, v).map(|at| {
                // A replacement route can hold the next extension of the list.
                // Keep the coverage already reached by the reader's ordinary view.
                v.history_horizon
                    .into_iter()
                    .chain(v.oldest_history_shown)
                    .fold(at, u64::min)
            });
            if v.history_horizon != next {
                v.history_horizon = next;
                v.dirty = true;
            }
        }
    }
}
