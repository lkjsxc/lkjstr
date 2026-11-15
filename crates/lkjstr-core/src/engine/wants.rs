//! Bound hydration to visible rows and share the resulting request filters.
use super::{Engine, protocol::Source, query};
use lkjstr_protocol::{NostrFilter, tags::tag_values};
impl Engine {
    pub(super) fn replan(&mut self, now: u64) {
        let mut wants = self.publication_wants(now);
        wants.extend(self.profile_wants());
        wants.extend(self.discovery_wants());
        wants.extend(self.channel_action_wants());
        for (sub, v) in self.views.iter().filter(|(_, v)| v.visible) {
            if matches!(v.query.source, Source::Relays | Source::Diagnostics) {
                continue;
            }
            for f in requests(&self.store, &self.network, v, self.signed_out_global_filter) {
                let mut q = v.query.clone();
                if matches!(q.source, Source::Channels | Source::Channel) {
                    let ids = q
                        .target
                        .clone()
                        .into_iter()
                        .chain(super::channels::joined(&self.store, q.account.as_deref()));
                    for id in ids {
                        q.filters
                            .relay_hints
                            .extend(super::channels::relays(&self.store, &id));
                    }
                    q.filters.relay_hints.sort();
                    q.filters.relay_hints.dedup();
                    q.filters.relay_hints.truncate(8);
                }
                wants.push((sub.clone(), f, q));
            }
        }
        let mut urls = self.network.relay_order.clone();
        for (_, _, q) in &wants {
            urls.extend(q.filters.relay_hints.iter().cloned());
        }
        let mut unique = std::collections::BTreeSet::new();
        urls.retain(|url| unique.insert(url.clone()));
        if urls.iter().any(|u| !self.network.relays.contains_key(u)) {
            let order = self.network.relay_order.clone();
            let known = self
                .network
                .known
                .keys()
                .cloned()
                .collect::<std::collections::BTreeSet<_>>();
            self.network.configure(urls, now);
            for (url, r) in &mut self.network.known {
                if !known.contains(url) {
                    r.read = false;
                    r.write = false;
                    r.search = false;
                }
            }
            self.network.relay_order = order;
        }
        self.network.plan(wants, &self.store, now);
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
    if q.source == Source::People {
        let authors = super::rich::authors(store, q).unwrap_or_default();
        return if authors.is_empty() {
            vec![]
        } else {
            vec![NostrFilter {
                kinds: Some(vec![0]),
                authors: Some(authors.into_iter().take(32).collect()),
                limit: Some(32),
                ..Default::default()
            }]
        };
    }
    let mut result = vec![query::filter(store, q)];
    if q.source == Source::TheirHome {
        result.push(NostrFilter {
            kinds: Some(vec![3]),
            authors: q.target.clone().map(|p| vec![p]),
            limit: Some(1),
            ..Default::default()
        });
    }
    result.extend(super::channels::wants(store, q));
    result.extend(v.history.clone());
    if let Some(f) = super::history::notification_filter(store, q) {
        result.push(f);
        result.extend(v.notification_history.clone());
    }
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
    let mut prefetch = crate::prefetch::collect_window(&events[range.clone()], store);
    for event in &events[range] {
        if matches!(event.kind, 6 | 7 | 16) {
            let ids = tag_values(event, "e")
                .into_iter()
                .filter(|id| store.get(id).is_none())
                .collect::<Vec<_>>();
            if !ids.is_empty() {
                prefetch.notes.extend(ids);
            }
        }
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
