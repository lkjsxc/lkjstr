//! Bound hydration to visible rows and share the resulting request filters.
use super::{Engine, protocol::Source, query};
use lkjstr_protocol::NostrFilter;
impl Engine {
    pub(super) fn replan(&mut self, now: u64) {
        let mut wants = self.publication_wants(now);
        wants.extend(self.cache_reference_wants());
        wants.extend(self.dm_wants.clone());
        wants.extend(self.zap_wants());
        wants.extend(self.profile_wants(now));
        wants.extend(self.outbox_wants(now));
        wants.extend(self.nearby_wants());
        wants.extend(self.discovery_wants());
        wants.extend(self.channel_action_wants());
        for (sub, v) in self.views.iter_mut().filter(|(_, v)| v.visible) {
            v.dirty |= v.time_window.is_some();
            if matches!(v.query.source, Source::Relays | Source::Diagnostics) {
                continue;
            }
            if v.query.source == Source::Emoji {
                wants.extend(
                    super::emoji::wants(&self.store, &v.query)
                        .into_iter()
                        .map(|(filter, query)| (sub.clone(), filter, query)),
                );
                continue;
            }
            wants.extend(super::time_window_older::intent(&self.store, sub, v));
            for f in requests(
                &self.store,
                &self.network,
                v,
                self.signed_out_global_filter,
                &self.private_lists,
            ) {
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
                let owner = if q.source != Source::Thread
                    && f.tags.contains_key("e")
                    && f.kinds
                        .as_ref()
                        .is_some_and(|ks| ks.contains(&7) && ks.contains(&9735))
                {
                    format!("~prefetch:{sub}")
                } else {
                    sub.clone()
                };
                wants.push((owner, f, q));
            }
        }
        self.plan_local_reads(&mut wants, now);
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
        self.network
            .plan_with_lists(wants, &self.store, &self.private_lists, now);
    }
}
fn requests(
    store: &crate::store::Store,
    network: &super::network::Network,
    v: &super::View,
    enabled: bool,
    private: &super::settings::PrivateLists,
) -> Vec<NostrFilter> {
    let q = &v.query;
    if query::signed_out(q) {
        return vec![];
    }
    if q.source == Source::People {
        return super::hydration::people(store, q, private);
    }
    let mut result = super::time_window::head(store, v);
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
    if q.source == Source::Thread {
        result.extend(super::thread::extra_filter(store, q));
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
    let events = super::time_window::events(store, v, private);
    let selected = super::windows::selection(store, network, v, enabled, &events, private);
    // Refill can cross the whole retained store. Hidden rows must not turn that
    // scan into count streams or consume the reference collector's row budget.
    let visible: Vec<_> = events[selected.raw.clone()]
        .iter()
        .zip(&selected.held)
        .filter(|(_, reason)| reason.is_none())
        .map(|(event, _)| event.clone())
        .collect();
    let references = super::acts::reference_rows(store, &visible);
    let counted = if super::acts::activity(q) {
        references.clone()
    } else {
        visible
            .iter()
            .filter(|event| !super::acts::is_act(event.kind))
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
            .filter(|event| super::acts::is_act(event.kind))
            .filter_map(|event| super::acts::resolve(store, event).missing)
            .take(120),
    );
    // A separate 120-target budget preserves visible reference capacity.
    ids.extend(super::windows::projection::targets(
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
            super::settings::list_tags(&list, private)
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
