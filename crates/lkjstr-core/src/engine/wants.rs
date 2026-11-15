//! Bound hydration to visible rows and share the resulting request filters.
use super::{Engine, protocol::Source, query};
use lkjstr_protocol::{NostrFilter, tags::tag_values};
impl Engine {
    pub(super) fn replan(&mut self, now: u64) {
        let mut wants = self.profile_wants();
        for (sub, v) in self.views.iter().filter(|(_, v)| v.visible) {
            if matches!(v.query.source, Source::Relays | Source::Diagnostics) {
                continue;
            }
            for f in requests(&self.store, &self.network, v, self.signed_out_global_filter) {
                wants.push((sub.clone(), f, v.query.clone()));
            }
        }
        self.network.plan(wants, now);
    }
}
fn requests(
    store: &crate::store::Store,
    network: &super::network::Network,
    v: &super::View,
    enabled: bool,
) -> Vec<NostrFilter> {
    let q = &v.query;
    if query::signed_out(q) {
        return vec![];
    }
    let mut result = vec![query::filter(store, q)];
    result.extend(v.history.clone());
    if q.source == Source::Thread
        && let Some(id) = &q.target
    {
        result.push(NostrFilter {
            ids: Some(vec![id.clone()]),
            limit: Some(1),
            ..Default::default()
        });
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
    let events = query::events(store, q);
    let range = super::windows::selection(store, network, v, enabled, &events).0;
    // Batch visible note counts; released with the view and bounded by its window.
    for events in events[range.clone()].chunks(120) {
        let mut f = NostrFilter {
            kinds: Some(vec![1, 6, 7, 9735]),
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
        result.push(NostrFilter {
            authors: Some(vec![p.clone()]),
            kinds: Some(vec![3]),
            limit: Some(1),
            ..Default::default()
        });
    }
    let prefetch = crate::prefetch::collect_window(&events[range], store);
    let mut ids = prefetch.notes;
    if q.source == Source::Bookmarks
        && let Some(list) = q
            .account
            .as_deref()
            .and_then(|a| store.replaceable(a, 10003))
    {
        ids.extend(
            tag_values(&list, "e")
                .into_iter()
                .filter(|id| store.get(id).is_none())
                .take(120),
        );
    }
    ids.sort();
    ids.dedup();
    ids.truncate(120);
    if !ids.is_empty() {
        result.push(NostrFilter {
            ids: Some(ids),
            limit: Some(120),
            ..Default::default()
        });
    }
    result
}
