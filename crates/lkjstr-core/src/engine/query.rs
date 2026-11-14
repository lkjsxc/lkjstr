//! Source selection and relay filters share one policy.
use super::query_predicates::matches_extra;
use super::{
    protocol::{Query, Source},
    rows::list_has,
};
use crate::store::{Event, Query as StoreQuery, Store};
use lkjstr_protocol::{NostrEvent, NostrFilter, reply_parent, tags::tag_values};
pub fn filter(store: &Store, q: &Query) -> NostrFilter {
    let mut f = NostrFilter {
        kinds: Some(vec![1, 6]),
        limit: Some(200),
        authors: q.filters.authors.clone(),
        since: q.filters.since,
        until: q.filters.until,
        ..Default::default()
    };
    let target = q.target.clone().unwrap_or_default();
    match q.source {
        Source::Home => {
            let mut authors = q
                .account
                .as_deref()
                .and_then(|a| store.follows(a))
                .unwrap_or_default();
            authors.extend(q.account.clone());
            f.authors = Some(authors);
        }
        Source::Profile => f.authors = Some(vec![target]),
        Source::Thread => {
            f.kinds = Some(vec![1]);
            f.tags.insert("e".into(), vec![target]);
        }
        Source::Notifications => {
            f.kinds = Some(vec![1, 3, 6, 7, 9735]);
            f.tags
                .insert("p".into(), q.account.clone().into_iter().collect());
        }
        Source::Search => f.search = q.filters.text.clone().or(q.target.clone()),
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
pub fn events(store: &Store, q: &Query) -> Vec<Event> {
    if q.source == Source::Thread {
        return store
            .thread(q.target.as_deref().unwrap_or(""))
            .into_iter()
            .filter(|e| matches_extra(e, q))
            .collect();
    }
    let f = filter(store, q);
    let mut events = store.feed(&StoreQuery {
        kinds: f.kinds.clone().unwrap_or_default(),
        authors: f.authors.clone().map(|a| a.into_iter().collect()),
        mention: f.tags.get("p").and_then(|v| v.first()).cloned(),
        until: f.until,
        limit: 6000,
        ..Default::default()
    });
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
    events.retain(|e| {
        (q.source == Source::Bookmarks || lkjstr_protocol::matches_filter(e, &f))
            && matches_extra(e, q)
    });
    events.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    // Several repost wrappers become one stable target row.
    let mut seen = std::collections::HashSet::new();
    events
        .into_iter()
        .filter_map(|e| {
            if e.kind == 6 && q.source != Source::Notifications {
                tag_values(&e, "e")
                    .last()
                    .and_then(|id| store.get(id))
                    .or(Some(e))
            } else {
                Some(e)
            }
        })
        .filter(|e| seen.insert(e.id.clone()))
        .collect()
}
pub fn hidden(store: &Store, q: &Query, e: &NostrEvent) -> Option<String> {
    let account = q.account.as_deref();
    for (tag, value, reason) in [
        ("p", e.pubkey.clone(), "muted-person"),
        (
            "e",
            reply_parent(e).unwrap_or_else(|| e.id.clone()),
            "muted-thread",
        ),
    ] {
        if list_has(store, account, 10000, tag, &value) {
            return Some(reason.into());
        }
    }
    let mute = account.and_then(|a| store.replaceable(a, 10000))?;
    for t in &mute.tags {
        if let Some(v) = t.get(1) {
            if t.first().is_some_and(|k| k == "word")
                && e.content.to_lowercase().contains(&v.to_lowercase())
            {
                return Some("muted-word".into());
            }
            if t.first().is_some_and(|k| k == "t")
                && tag_values(e, "t").iter().any(|s| s.eq_ignore_ascii_case(v))
            {
                return Some("muted-hashtag".into());
            }
        }
    }
    None
}
