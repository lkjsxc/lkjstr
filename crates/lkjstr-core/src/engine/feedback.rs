//! Cheap bounded observations and upload defaults. No event bodies or keys.
use super::Engine;
use serde_json::{Value, json};
pub const BLOSSOM_SERVERS: [&str; 3] = [
    "https://blossom.primal.net",
    "https://blossom.nostr.build",
    "https://nostr.download",
];
impl Engine {
    /// An explicit kind 10063, including an empty list, overrides defaults.
    pub fn upload_servers(&self, account: &str) -> Vec<String> {
        self.store
            .replaceable(account, 10063)
            .map(|e| lkjstr_protocol::tags::tag_values(&e, "server"))
            .unwrap_or_else(|| BLOSSOM_SERVERS.iter().map(|s| (*s).into()).collect())
    }
    /// Never choose a default while the owner list lookup is still unresolved.
    pub fn upload_servers_ready(&self, account: &str) -> bool {
        self.store.replaceable(account, 10063).is_some()
            || self.network.list_loaded(&self.store, account, 10063)
    }
    pub fn stats(&self) -> Value {
        let followed = self
            .views
            .values()
            .filter(|v| v.visible && v.query.source == super::protocol::Source::Home)
            .filter_map(|v| v.query.account.as_deref())
            .flat_map(|a| self.store.follows(a).unwrap_or_default())
            .collect::<std::collections::BTreeSet<_>>();
        let coverage = self.network.followed_coverage(&followed, &self.store);
        let publication_stats = self.network.publication_stats();
        let open_subscriptions = self.network.open_wires();
        let urls = self
            .network
            .relays
            .keys()
            .chain(self.network.known.keys())
            .cloned()
            .chain(publication_stats.keys().map(|url| (*url).to_owned()))
            .collect::<std::collections::BTreeSet<_>>();
        let idle = super::network::Relay::default();
        let no_publications = Default::default();
        let relays = urls.iter().map(|url| {
            let r = self.network.relays.get(url).unwrap_or(&idle);
            let mut row = json!({"url":url,"state":if r.online {"connected"} else if r.connecting {"connecting"} else if r.failures>0 {"waiting"} else {"idle"},
                "connectedSince":r.connected_since,"eventsReceived":r.received,"duplicatesDropped":r.duplicates,
                "openSubscriptions":open_subscriptions.get(url.as_str()).copied().unwrap_or(0),
                "bytesIn":r.bytes_in,"bytesOut":r.bytes_out,"lastError":if self.network.deferred_relays.contains(url) {Some("capacity".to_owned())} else {r.last_error.clone()},"latencyMs":r.latency_ms});
            if let (Some(row), Some(publication)) = (row.as_object_mut(), json!(publication_stats.get(url.as_str()).unwrap_or(&no_publications)).as_object()) {
                row.extend(publication.clone());
            }
            if let (Some(row), Some(routing)) = (row.as_object_mut(), self.network.routing_stats(url, coverage.get(url).copied().unwrap_or(0)).as_object()) { row.extend(routing.clone()); }
            row
        }).collect::<Vec<_>>();
        let network = self.network.relays.values().map(|r| r.useful).sum::<u64>();
        let subscriptions: usize = open_subscriptions.values().sum();
        let coalesced = self
            .network
            .requests
            .values()
            .map(|q| q.members.len().saturating_sub(1))
            .sum::<usize>()
            + self
                .network
                .requests
                .values()
                .filter(|r| r.sent)
                .count()
                .saturating_sub(subscriptions);
        let covering = self
            .network
            .requests
            .values()
            .filter(|q| {
                q.sent
                    && q.filter.kinds.as_ref().is_some_and(|ks| ks.contains(&1))
                    && q.filter
                        .authors
                        .as_ref()
                        .is_some_and(|authors| authors.iter().any(|a| followed.contains(a)))
            })
            .map(|q| &q.relay)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        json!({"requests":self.network.request_stats(),"recentPublications":self.network.recent_publications(),"relays":relays,"totals":{"eventsStored":self.store.len(),"cacheBytes":self.store.payload_bytes(),
            "subscriptions":subscriptions,"servedFromCache":self.metrics.served_from_cache,"servedFromNetwork":network},
            "orchestration":{"relaysCoveringFollowSet":covering,"requestsCoalesced":coalesced}})
    }
}
