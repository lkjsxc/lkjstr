use super::protocol::{Query, Source};
pub(super) use super::query_predicates::{matches_extra, signed_out};
use crate::{
    kinds::{Feed, PUBLIC_LIST_KINDS, feed_kinds, policy},
    store::{Event, Query as StoreQuery, Store},
};
use lkjstr_protocol::{NostrFilter, tags::tag_values};
pub fn filter(store: &Store, q: &Query) -> NostrFilter {
    let mut f = NostrFilter {
        kinds: Some(feed_kinds(Feed::Timeline)),
        limit: Some(200),
        authors: super::rich::authors(store, q),
        since: q.filters.since,
        until: q.filters.until,
        ..Default::default()
    };
    let target = q.target.clone().unwrap_or_default();
    match q.source {
        Source::Channels => {
            f.kinds = Some(feed_kinds(Feed::Channels));
            f.since = None;
            f.until = None;
            f.authors = None;
            f.ids = q.target.clone().map(|id| vec![id]);
        }
        Source::Channel => {
            f.kinds = Some(feed_kinds(Feed::Channel));
            f.tags.insert("e".into(), vec![target]);
        }
        Source::People => {
            f.kinds = Some(feed_kinds(Feed::People));
            f.limit = Some(32);
        }
        Source::TheirHome | Source::Home => {
            let owner = if q.source == Source::TheirHome {
                q.target.as_deref()
            } else {
                q.account.as_deref()
            };
            let mut authors = owner.and_then(|key| store.follows(key)).unwrap_or_default();
            authors.extend(owner.map(str::to_owned));
            authors.sort();
            authors.dedup();
            f.authors = Some(authors);
        }
        Source::Profile => {
            f.authors = Some(vec![target]);
            f.kinds = Some(match q.filters.show.as_deref() {
                Some("reposts") => feed_kinds(Feed::ProfileReposts),
                Some("reactions") => feed_kinds(Feed::ProfileReactions),
                Some("articles") => vec![30023],
                Some("lists") => PUBLIC_LIST_KINDS.to_vec(),
                Some("all") => vec![],
                _ => feed_kinds(Feed::ProfilePosts),
            });
            if q.filters.show.as_deref() == Some("all") {
                f.kinds = None;
            }
        }
        Source::Thread => {
            if let Some(address) = super::thread::address(&target) {
                return super::thread::address_filter(address);
            }
            f.kinds = Some(feed_kinds(Feed::ThreadReplies));
            f.tags.insert("e".into(), vec![target]);
        }
        Source::Notifications => {
            f.kinds = Some(feed_kinds(Feed::Notifications));
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
            f.kinds = Some(feed_kinds(Feed::Followers));
            f.tags.insert("p".into(), vec![target]);
        }
        Source::Following => {
            f.kinds = Some(feed_kinds(Feed::Following));
            f.authors = Some(vec![target]);
        }
        Source::Bookmarks | Source::Mutes | Source::List | Source::MediaServers | Source::Emoji => {
            f.kinds = Some(feed_kinds(match q.source {
                Source::Bookmarks => Feed::Bookmarks,
                Source::Mutes => Feed::Mutes,
                Source::MediaServers => Feed::MediaServers,
                Source::Emoji => Feed::Emoji,
                _ => Feed::List,
            }));
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
pub fn events(store: &Store, q: &Query) -> Vec<Event> {
    select(store, q, true)
}
pub(super) fn select(store: &Store, q: &Query, collapse_acts: bool) -> Vec<Event> {
    if signed_out(q) {
        return vec![];
    }
    if matches!(q.source, Source::Channels | Source::People) {
        return vec![];
    }
    if q.source == Source::Thread {
        let Some(focus) = q
            .target
            .as_deref()
            .and_then(|target| super::thread::focus(store, target))
        else {
            return vec![];
        };
        return super::thread::ordered(store, &focus)
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
    if q.source == Source::Profile && q.filters.show.as_deref() == Some("all") {
        return events
            .into_iter()
            .filter(|e| policy(e.kind).openable)
            .collect();
    }
    if collapse_acts && super::acts::activity(q) {
        return super::acts::representatives(store, events);
    }
    let mut seen = std::collections::HashSet::new();
    events
        .into_iter()
        .filter_map(|event| collapse_repost(store, q, event))
        .filter(|e| policy(e.kind).openable && seen.insert(e.id.clone()))
        .collect()
}

pub(super) fn collapse_repost(store: &Store, q: &Query, event: Event) -> Option<Event> {
    if event.kind != 6
        || q.source == Source::Notifications
        || q.filters.show.as_deref() == Some("reposts")
    {
        return Some(event);
    }
    let target = super::acts::target(&event).and_then(|id| store.get(&id));
    if target.as_ref().is_some_and(|target| target.kind == 42)
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
    {
        return None;
    }
    target.or(Some(event))
}
pub(super) use super::query_hidden::matches_note;
pub use super::query_hidden::{hidden, hidden_with_lists};

pub(super) use super::query_predicates::accepts;
