//! Source selection and relay filters share one policy.
use super::protocol::{Query, Source};
use super::query_predicates::matches_extra;
use crate::store::{Event, Query as StoreQuery, Store};
use lkjstr_protocol::{NostrFilter, tags::tag_values};
pub fn filter(store: &Store, q: &Query) -> NostrFilter {
    let mut f = NostrFilter {
        kinds: Some(vec![1, 6]),
        limit: Some(200),
        authors: super::rich::authors(store, q),
        since: q.filters.since,
        until: q.filters.until,
        ..Default::default()
    };
    let target = q.target.clone().unwrap_or_default();
    match q.source {
        Source::Channels => {
            f.kinds = Some(vec![40]);
            f.authors = None;
            f.ids = q.target.clone().map(|id| vec![id]);
        }
        Source::Channel => {
            f.kinds = Some(vec![42]);
            f.tags.insert("e".into(), vec![target]);
        }
        Source::People => {
            f.kinds = Some(vec![0]);
            f.limit = Some(32);
        }
        Source::TheirHome => {
            f.authors = Some(store.follows(&target).unwrap_or_default());
        }
        Source::Home => {
            let mut authors = q
                .account
                .as_deref()
                .and_then(|a| store.follows(a))
                .unwrap_or_default();
            authors.extend(q.account.clone());
            f.authors = Some(authors);
        }
        Source::Profile => {
            f.authors = Some(vec![target]);
            f.kinds = Some(match q.filters.show.as_deref() {
                Some("reposts") => vec![6, 16],
                Some("reactions") => vec![7],
                _ => vec![1],
            });
        }
        Source::Thread => {
            f.kinds = Some(vec![1, 42]);
            f.tags.insert("e".into(), vec![target]);
        }
        Source::Notifications => {
            f.kinds = Some(vec![1, 42, 3, 6, 16, 7, 9735]);
            f.tags
                .insert("p".into(), q.account.clone().into_iter().collect());
        }
        Source::Search => {
            f.search = q
                .filters
                .text
                .as_deref()
                .and_then(|t| t.split_whitespace().next())
                .map(str::to_owned)
                .or(q.target.clone())
        }
        Source::Hashtag => {
            f.tags.insert("t".into(), vec![target.to_lowercase()]);
        }
        Source::Followers => {
            f.kinds = Some(vec![3]);
            f.tags.insert("p".into(), vec![target]);
        }
        Source::Following => {
            f.kinds = Some(vec![0, 3]);
            f.authors = Some(vec![target]);
        }
        Source::Bookmarks | Source::Mutes | Source::List | Source::MediaServers | Source::Emoji => {
            f.kinds = Some(vec![match q.source {
                Source::Bookmarks => 10003,
                Source::Mutes => 10000,
                Source::MediaServers => 10063,
                Source::Emoji => 10030,
                _ => 30000,
            }]);
            f.authors = Some(q.account.clone().into_iter().collect());
            if q.source == Source::List
                && let Ok(address) = lkjstr_nips::address::Coordinate::parse(&target)
            {
                f.kinds = Some(vec![address.kind.into()]);
                f.authors = Some(vec![address.pubkey]);
                f.tags.insert("d".into(), vec![address.identifier]);
            }
        }
        _ => {}
    }
    f
}
/// These views have no event source until an account is selected.
pub(super) fn signed_out(q: &Query) -> bool {
    q.account.is_none()
        && matches!(
            q.source,
            Source::Home
                | Source::Notifications
                | Source::Bookmarks
                | Source::Mutes
                | Source::Emoji
                | Source::MediaServers
        )
}
pub fn events(store: &Store, q: &Query) -> Vec<Event> {
    if signed_out(q) {
        return vec![];
    }
    if matches!(q.source, Source::Channels | Source::People) {
        return vec![];
    }
    if q.source == Source::Thread {
        return store
            .thread(q.target.as_deref().unwrap_or(""))
            .into_iter()
            .filter(|e| {
                matches_extra(e, q)
                    && super::rich::authors(store, q)
                        .as_ref()
                        .is_none_or(|a| a.contains(&e.pubkey))
            })
            .collect();
    }
    let f = filter(store, q);
    let mut events = if q.source == Source::Channel {
        store.referencing(q.target.as_deref().unwrap_or(""))
    } else {
        store.feed(&StoreQuery {
            kinds: f.kinds.clone().unwrap_or_default(),
            authors: f.authors.clone().map(|a| a.into_iter().collect()),
            mention: f.tags.get("p").and_then(|v| v.first()).cloned(),
            until: f.until,
            limit: store.len(),
            ..Default::default()
        })
    };
    if q.source == Source::Bookmarks {
        events = q
            .account
            .as_deref()
            .and_then(|a| store.replaceable(a, 10003))
            .map(|e| {
                tag_values(&e, "e")
                    .iter()
                    .filter_map(|id| store.get(id))
                    .collect()
            })
            .unwrap_or_default();
    }
    let authors = super::rich::authors(store, q);
    events.retain(|e| accepts(store, q, e, &f, &authors));
    events.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    if q.filters.notifications == Some(true)
        && matches!(q.source, Source::Home | Source::Global | Source::TheirHome)
    {
        let mut news = q.clone();
        news.source = Source::Notifications;
        news.filters.notifications = None;
        events.extend(self::events(store, &news));
        events.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    }
    // Several repost wrappers become one stable target row.
    let mut seen = std::collections::HashSet::new();
    events
        .into_iter()
        .filter_map(|e| {
            if e.kind == 6
                && q.source != Source::Notifications
                && q.filters.show.as_deref() != Some("reposts")
            {
                let target = tag_values(&e, "e").last().and_then(|id| store.get(id));
                if target.as_ref().is_some_and(|t| {
                    t.kind == 42
                        && matches!(
                            q.source,
                            Source::Home
                                | Source::TheirHome
                                | Source::Global
                                | Source::Relay
                                | Source::Hashtag
                                | Source::Search
                                | Source::List
                        )
                }) {
                    None
                } else {
                    target.or(Some(e))
                }
            } else {
                Some(e)
            }
        })
        .filter(|e| seen.insert(e.id.clone()))
        .collect()
}
pub(super) use super::query_hidden::matches_note;
pub use super::query_hidden::{hidden, hidden_with_lists};

/// Shared membership predicate for ordinary windows and the incremental time index.
pub(super) fn accepts(
    store: &Store,
    q: &Query,
    e: &lkjstr_protocol::NostrEvent,
    f: &NostrFilter,
    authors: &Option<Vec<String>>,
) -> bool {
    (q.source != Source::Channel || lkjstr_protocol::channel_id(e).as_ref() == q.target.as_ref())
        && authors.as_ref().is_none_or(|a| a.contains(&e.pubkey))
        && (q.source == Source::Bookmarks || lkjstr_protocol::matches_filter(e, f))
        && if q.source == Source::Profile
            && matches!(q.filters.show.as_deref(), Some("reposts" | "reactions"))
        {
            tag_values(e, "e")
                .last()
                .and_then(|id| store.get(id))
                .is_none_or(|target| {
                    let mut shown = q.clone();
                    shown.filters.authors = None;
                    shown.filters.from = None;
                    shown.filters.since = None;
                    shown.filters.until = None;
                    matches_extra(&target, &shown)
                })
        } else if e.kind == 6 && q.source != Source::Notifications {
            q.filters.reposts != Some(false)
                && tag_values(e, "e")
                    .last()
                    .and_then(|id| store.get(id))
                    .is_none_or(|target| matches_note(store, q, &target))
        } else {
            matches_extra(e, q)
        }
}
