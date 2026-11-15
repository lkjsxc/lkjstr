//! NIP-28 policy over the bounded event store; no independent event collection.
use crate::store::{Event, Store};
use lkjstr_protocol::{NostrEntity, NostrFilter, decode_nip19, is_event_id, tags::tag_values};
use serde_json::{Value, json};
pub fn reference(raw: &str) -> Option<(String, Vec<String>)> {
    let raw = raw.trim().strip_prefix("nostr:").unwrap_or(raw.trim());
    if is_event_id(raw) {
        return Some((raw.into(), vec![]));
    }
    match decode_nip19(raw)? {
        NostrEntity::Note(id) => Some((id, vec![])),
        NostrEntity::Nevent(p) => Some((
            p.id,
            p.relays
                .unwrap_or_default()
                .into_iter()
                .filter_map(|u| super::settings::strict_relay(&u))
                .take(8)
                .collect(),
        )),
        _ => None,
    }
}
pub fn joined(store: &Store, account: Option<&str>) -> Vec<String> {
    account
        .and_then(|a| store.replaceable(a, 10005))
        .map(|e| {
            tag_values(&e, "e")
                .into_iter()
                .filter(|id| is_event_id(id))
                .take(1000)
                .collect()
        })
        .unwrap_or_default()
}
/// Latest valid creator update wins; event-id ascending breaks timestamp ties.
pub fn metadata(store: &Store, id: &str) -> (Value, Option<Event>) {
    let Some(creation) = store.get(id).filter(|e| e.kind == 40) else {
        return (json!({}), None);
    };
    let update = store
        .referencing(id)
        .into_iter()
        .filter(|e| {
            e.kind == 41
                && e.pubkey == creation.pubkey
                && tag_values(e, "e").first().is_some_and(|v| v == id)
        })
        .max_by(|a, b| {
            a.created_at
                .cmp(&b.created_at)
                .then_with(|| b.id.cmp(&a.id))
        });
    let data = update.as_ref().unwrap_or(&creation);
    (
        serde_json::from_str(&data.content).unwrap_or_else(|_| json!({})),
        Some(creation),
    )
}
pub fn messages(store: &Store, id: &str) -> Vec<Event> {
    let mut events = store
        .referencing(id)
        .into_iter()
        .filter(|e| lkjstr_protocol::channel_id(e).as_deref() == Some(id))
        .collect::<Vec<_>>();
    events.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    events
}
pub fn relays(store: &Store, id: &str) -> Vec<String> {
    let (data, creation) = metadata(store, id);
    let mut urls = store
        .seen_on(id)
        .iter()
        .filter_map(|url| super::settings::strict_relay(url))
        .collect::<Vec<_>>();
    for value in [
        Some(data),
        creation.and_then(|e| serde_json::from_str(&e.content).ok()),
    ]
    .into_iter()
    .flatten()
    {
        urls.extend(
            value["relays"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|v| v.as_str())
                .filter_map(super::settings::strict_relay),
        );
    }
    urls.sort();
    urls.dedup();
    urls.truncate(8);
    urls
}
pub(super) fn wants(store: &Store, q: &super::Query) -> Vec<NostrFilter> {
    use super::protocol::Source;
    if !matches!(q.source, Source::Channels | Source::Channel) {
        return vec![];
    }
    let mut ids = if let Some(id) = &q.target
        && q.source == Source::Channels
    {
        vec![id.clone()]
    } else {
        joined(store, q.account.as_deref())
            .into_iter()
            .chain(
                store
                    .feed(&crate::store::Query {
                        kinds: vec![40],
                        limit: 1000,
                        ..Default::default()
                    })
                    .iter()
                    .map(|e| e.id.clone()),
            )
            .chain(q.target.iter().cloned())
            .collect()
    };
    ids.sort();
    ids.dedup();
    ids.truncate(1000);
    let mut out = vec![];
    if let Some(account) = &q.account {
        out.push(NostrFilter {
            authors: Some(vec![account.clone()]),
            kinds: Some(vec![10005]),
            limit: Some(1),
            ..Default::default()
        });
    }
    for ids in ids.chunks(120) {
        out.push(NostrFilter {
            ids: Some(ids.to_vec()),
            limit: Some(120),
            ..Default::default()
        });
        // Metadata must not compete with newer messages for a relay's limit.
        for kind in [41, 42] {
            let mut f = NostrFilter {
                kinds: Some(vec![kind]),
                limit: Some(200),
                ..Default::default()
            };
            f.tags.insert("e".into(), ids.to_vec());
            out.push(f);
        }
    }
    out
}
