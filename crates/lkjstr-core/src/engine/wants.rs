//! Bound hydration to visible rows and share the resulting request filters.
use super::{Engine, protocol::Source};
#[path = "wants_filters.rs"]
mod filters;
use filters::requests;
impl Engine {
    pub(super) fn replan(&mut self, now: u64) {
        self.network.telemetry.views = self
            .telemetry_views()
            .into_iter()
            .map(|(sub, view)| (sub.to_owned(), view.telemetry_id))
            .collect();
        let mut wants = self.publication_wants(now);
        wants.extend(self.cache_reference_wants());
        wants.extend(self.dm_wants.clone());
        wants.extend(self.zap_wants());
        wants.extend(self.profile_wants(now));
        wants.extend(self.outbox_wants(now));
        wants.extend(self.nearby_wants());
        wants.extend(self.discovery_wants());
        wants.extend(self.channel_action_wants());
        wants.extend(self.client_info_wants());
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
            wants.extend(super::time_window_relay::intents(&self.store, sub, v));
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
                let owner = if f.kinds.as_deref() == Some(&[5])
                    || (q.source != Source::Thread
                        && f.tags.contains_key("e")
                        && f.kinds
                            .as_ref()
                            .is_some_and(|ks| ks.contains(&7) && ks.contains(&9735)))
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
