use super::super::{self as engine, protocol::Source, query};
use lkjstr_protocol::NostrFilter;
pub(super) fn requests(
    store: &crate::store::Store,
    network: &engine::network::Network,
    v: &engine::View,
    enabled: bool,
    private: &engine::settings::PrivateLists,
) -> Vec<NostrFilter> {
    let q = &v.query;
    if query::signed_out(q) {
        return vec![];
    }
    if q.source == Source::People {
        return engine::hydration::people(store, q, private);
    }
    let mut result = engine::time_window::head(store, v);
    if q.source == Source::TheirHome {
        result.push(NostrFilter {
            kinds: Some(vec![3]),
            authors: q.target.clone().map(|p| vec![p]),
            limit: Some(1),
            ..Default::default()
        });
    }
    result.extend(engine::channels::wants(store, q));
    result.extend(v.history.clone());
    if let Some(f) = engine::history::notification_filter(store, q) {
        result.push(f);
        result.extend(v.notification_history.clone());
    }
    if q.source == Source::Thread {
        result.extend(engine::thread::extra_filter(store, q));
        result.extend(engine::thread::comment_filters(store, q));
    }
    if let Some(account) = &q.account {
        let kinds: Vec<_> = [0, 3, 10000, 10003, 10002, 10030, 10063]
            .into_iter()
            .filter(|k| store.replaceable(account, *k).is_none())
            .collect();
        if !kinds.is_empty() {
            result.push(NostrFilter {
                authors: Some(vec![account.clone()]),
                kinds: Some(kinds),
                limit: Some(7),
                ..Default::default()
            });
        }
    }
    let events = engine::time_window::events(store, v, private);
    let selected = engine::windows::selection(store, network, v, enabled, &events, private);
    // Refill can cross the whole retained store. Hidden rows must not turn that
    // scan into count streams or consume the reference collector's row budget.
    let visible: Vec<_> = events[selected.raw.clone()]
        .iter()
        .zip(&selected.held)
        .filter(|(_, reason)| reason.is_none())
        .map(|(event, _)| event.clone())
        .collect();
    result.extend(engine::visibility::deletion_filter(
        store,
        v,
        &events[selected.raw.clone()],
        &selected.held,
    ));
    let references = engine::acts::reference_rows(store, &visible);
    let counted = if engine::acts::activity(q) {
        references.clone()
    } else {
        visible
            .iter()
            .filter(|event| !engine::acts::is_act(event.kind))
            .cloned()
            .collect()
    };
    // Only displayed notes need counts; an act's counts have no surface yet.
    for events in counted.chunks(120) {
        let mut f = NostrFilter {
            kinds: Some(if events.iter().any(|e| e.kind == 42) {
                if events.iter().any(|e| e.kind != 42) {
                    vec![1, 42, 6, 16, 7, 9735]
                } else {
                    vec![42, 16, 7, 9735]
                }
            } else {
                vec![1, 6, 7, 9735]
            }),
            limit: Some(200),
            ..Default::default()
        };
        f.tags
            .insert("e".into(), events.iter().map(|e| e.id.clone()).collect());
        result.push(f);
    }
    if q.source == Source::Profile
        && let Some(p) = &q.target
    {
        if !q.filters.relay_hints.is_empty() {
            result.push(NostrFilter {
                kinds: Some(vec![0]),
                authors: Some(vec![p.clone()]),
                limit: Some(1),
                ..Default::default()
            });
        }
        let mut followers = NostrFilter {
            kinds: Some(vec![3]),
            limit: Some(200),
            ..Default::default()
        };
        followers.tags.insert("p".into(), vec![p.clone()]);
        result.push(followers);
        result.push(NostrFilter {
            authors: Some(vec![p.clone()]),
            kinds: Some(vec![1]),
            limit: Some(200),
            ..Default::default()
        });
        if store.replaceable(p, 3).is_none() {
            result.push(NostrFilter {
                authors: Some(vec![p.clone()]),
                kinds: Some(vec![3]),
                limit: Some(1),
                ..Default::default()
            });
        }
    }
    let mut ids = crate::prefetch::collect_window(&references, store).notes;
    ids.extend(
        visible
            .iter()
            .filter(|event| engine::acts::is_act(event.kind))
            .filter_map(|event| engine::acts::resolve(store, event).missing)
            .take(120),
    );
    // A separate 120-target budget preserves visible reference capacity.
    ids.extend(engine::windows::projection::targets(
        &events[selected.raw],
        &selected.held,
        store,
    ));
    if q.source == Source::Bookmarks
        && let Some(list) = q
            .account
            .as_deref()
            .and_then(|a| store.replaceable(a, 10003))
    {
        ids.extend(
            engine::settings::list_tags(&list, private)
                .into_iter()
                .filter(|t| t.first().is_some_and(|k| k == "e"))
                .filter_map(|t| t.get(1).cloned())
                .filter(|id| lkjstr_protocol::is_event_id(id) && store.get(id).is_none()),
        );
    }
    ids.sort();
    ids.dedup();
    for chunk in ids.chunks(120) {
        result.push(NostrFilter {
            ids: Some(chunk.to_vec()),
            limit: Some(120),
            ..Default::default()
        });
    }
    result
}
