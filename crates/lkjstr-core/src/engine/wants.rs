//! Bound hydration to visible rows and share the resulting request filters.
use super::{Engine, protocol::Source, query};
use lkjstr_protocol::{NostrFilter, tags::tag_values};
impl Engine {
    pub(super) fn replan(&mut self, now: u64) {
        let mut wants = Vec::new();
        for (sub, v) in self.views.iter().filter(|(_, v)| v.visible) {
            if matches!(v.query.source, Source::Relays | Source::Diagnostics) {
                continue;
            }
            for f in requests(&self.store, v) {
                wants.push((sub.clone(), f, v.query.clone()));
            }
        }
        self.network.plan(wants, now);
    }
}
fn requests(store: &crate::store::Store, v: &super::View) -> Vec<NostrFilter> {
    let q = &v.query;
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
    let mut people = Vec::new();
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
    if matches!(q.source, Source::Profile | Source::Following)
        && let Some(target) = &q.target
    {
        people.push(target.clone());
    }
    let events = query::events(store, q);
    let range = super::windows::range(v, &events);
    let prefetch = crate::prefetch::collect_window(&events[range], store);
    people.extend(prefetch.people);
    people.sort();
    people.dedup();
    people.truncate(120);
    if !people.is_empty() {
        result.push(NostrFilter {
            authors: Some(people),
            kinds: Some(vec![0, 10002]),
            limit: Some(240),
            ..Default::default()
        });
    }
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
