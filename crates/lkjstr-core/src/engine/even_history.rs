//! Shared admission boundary for merged chronological windows and the time rail.
use super::{Engine, Query, View, network::Network, protocol::Source, query, settings};
use crate::store::Store;
use lkjstr_protocol::NostrFilter;

pub(super) const PREVIEW_SECONDS: u64 = 86_400;
const FOLLOW_CONTRIBUTORS: usize = 3;

#[derive(PartialEq, Eq)]
pub(super) struct ProofScope {
    follow: Option<String>,
    mute: Option<(String, bool)>,
    removals: u64,
}

pub(super) fn merged(v: &View) -> bool {
    v.time_window.is_none()
        && matches!(
            v.query.source,
            Source::Home
                | Source::TheirHome
                | Source::Global
                | Source::Hashtag
                | Source::Channel
                | Source::Notifications
        )
}

pub(super) fn preview_boundary(v: &View) -> Option<u64> {
    (merged(v) && !query::signed_out(&v.query)).then(|| {
        let now = v.opened_at / 1000;
        v.query
            .filters
            .until
            .unwrap_or(now)
            .min(now)
            .saturating_sub(PREVIEW_SECONDS)
            .max(v.query.filters.since.unwrap_or(0))
    })
}

pub(super) struct Scope<'a> {
    store: &'a Store,
    private: &'a settings::PrivateLists,
    q: &'a super::Query,
    filter: &'a NostrFilter,
    authors: &'a Option<Vec<String>>,
    owner: Option<&'a str>,
    pub required: usize,
}

impl Scope<'_> {
    pub(super) fn contributor(&self, id: &str) -> Option<String> {
        let event = self.store.lease(id)?;
        // A repost cannot contribute a second copy or lend the wrapper's author.
        if event.kind == 6 || (self.owner.is_some() && event.kind != 1) {
            return None;
        }
        let key = event.pubkey_hex();
        if self.owner.or(self.q.account.as_deref()) == Some(key.as_str()) {
            return None;
        }
        let event = event.materialize();
        (query::accepts(self.store, self.q, &event, self.filter, self.authors)
            && super::visibility::reason(self.store, self.q, &event, self.private).is_none())
        .then_some(key)
    }
}

/// Newest time at which a matching visitor Global row fits inside the preview.
/// Reposts must fit both by placement and by the projected note's time.
fn visitor_preview_head(store: &Store, q: &Query) -> Option<u64> {
    let filter = query::filter(store, q);
    let authors = super::rich::authors(store, q);
    let mut newest = None;
    for event in store.feed_iter_since(&query::store_query(&filter, store.len()), filter.since) {
        if newest.is_some_and(|at| event.created_at <= at) {
            break;
        }
        if !query::accepts(store, q, &event, &filter, &authors) {
            continue;
        }
        let placed_at = event.created_at;
        if let Some(note) = query::collapse_repost(store, q, event)
            && crate::kinds::policy(note.kind).openable
            && !super::windows::projection::unavailable(store, q, &note)
        {
            newest = newest.max(Some(placed_at.min(note.created_at)));
        }
    }
    newest.filter(|at| *at >= filter.since.unwrap_or_default())
}

fn horizon(
    network: &Network,
    store: &Store,
    private: &settings::PrivateLists,
    sub: &str,
    v: &mut View,
) -> Option<u64> {
    let preview = preview_boundary(v)?;
    let q = &v.query;
    let owner = match q.source {
        Source::Home => q.account.as_deref(),
        Source::TheirHome => q.target.as_deref(),
        _ => None,
    };
    let follow = owner.and_then(|key| store.replaceable_lease(key, 3));
    let mute = q
        .account
        .as_deref()
        .and_then(|key| store.replaceable_lease(key, 10000));
    let proof_scope = ProofScope {
        follow: follow.map(|event| event.id_hex()),
        mute: mute.map(|event| {
            let id = event.id_hex();
            let unlocked = private.contains_key(&id);
            (id, unlocked)
        }),
        removals: store.history_removals(),
    };
    let mut edge = if v.history_scope.as_ref() == Some(&proof_scope) {
        v.history_horizon.unwrap_or(preview)
    } else {
        v.history_scope = Some(proof_scope);
        preview
    };
    // Quiet visitor feeds can start at the latest retained note. Keep that
    // preview admitted for this view if newer notes arrive while it is read.
    let since = q.filters.since.unwrap_or_default();
    if v.dirty
        && edge == preview
        && preview > since
        && q.source == Source::Global
        && q.account.is_none()
        && let Some(at) = visitor_preview_head(store, q)
        && at < preview
    {
        edge = at.saturating_sub(PREVIEW_SECONDS).max(since);
    }
    if edge == 0 || (owner.is_some() && follow.is_none()) || !network.has_history_answer(sub) {
        return Some(edge);
    }
    let filter = query::filter(store, q);
    let authors = super::rich::authors(store, q);
    let mutes = mute.map_or_else(Vec::new, |e| settings::list_tags(&e.materialize(), private));
    let muted: std::collections::BTreeSet<_> = mutes
        .iter()
        .filter(|tag| tag.first().is_some_and(|key| key == "p"))
        .filter_map(|tag| tag.get(1))
        .collect();
    let exact_view = matches!(q.source, Source::Channel | Source::Notifications);
    let required = if exact_view {
        0
    } else {
        filter
            .authors
            .as_ref()
            .map_or(FOLLOW_CONTRIBUTORS, |group| {
                group
                    .iter()
                    .filter(|author| {
                        owner.or(q.account.as_deref()) != Some(author.as_str())
                            && authors.as_ref().is_none_or(|a| a.contains(author))
                            && !muted.contains(author)
                    })
                    .take(FOLLOW_CONTRIBUTORS)
                    .count()
            })
    };
    let scope = Scope {
        store,
        private,
        q,
        filter: &filter,
        authors: &authors,
        owner,
        required,
    };
    let notes = network.history_boundary(sub, &filter, &scope, edge);
    if let Some(news) = super::history::notification_filter(store, q) {
        let overlay = Scope {
            required: 0,
            ..scope
        };
        return Some(notes.max(network.history_boundary(sub, &news, &overlay, edge)));
    }
    Some(notes)
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
            let next = horizon(&self.network, &self.store, &self.private_lists, sub, v);
            if v.history_horizon != next {
                v.history_horizon = next;
                v.dirty = true;
            }
        }
    }
}
