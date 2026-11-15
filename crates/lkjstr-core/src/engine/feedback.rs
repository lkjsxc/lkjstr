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
        let relays = self.network.relays.iter().map(|(url, r)| {
            json!({"url":url,"state":if r.online {"connected"} else if r.connecting {"connecting"} else if r.failures>0 {"waiting"} else {"idle"},
                "connectedSince":r.connected_since,"eventsReceived":r.received,"duplicatesDropped":r.duplicates,
                "openSubscriptions":self.network.requests.values().filter(|q|q.relay==*url && q.sent).count(),
                "bytesIn":r.bytes_in,"bytesOut":r.bytes_out,"lastError":r.last_error,"latencyMs":r.latency_ms})
        }).collect::<Vec<_>>();
        let network = self.network.relays.values().map(|r| r.useful).sum::<u64>();
        let subscriptions = self.network.requests.values().filter(|q| q.sent).count();
        let coalesced = self
            .network
            .requests
            .values()
            .map(|q| q.members.len().saturating_sub(1))
            .sum::<usize>();
        let followed = self
            .views
            .values()
            .filter(|v| v.visible && v.query.source == super::protocol::Source::Home)
            .filter_map(|v| v.query.account.as_deref())
            .flat_map(|a| self.store.follows(a).unwrap_or_default())
            .collect::<std::collections::BTreeSet<_>>();
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
        json!({"relays":relays,"totals":{"eventsStored":self.store.len(),"cacheBytes":self.store.payload_bytes(),
            "subscriptions":subscriptions,"servedFromCache":self.metrics.served_from_cache,"servedFromNetwork":network},
            "orchestration":{"relaysCoveringFollowSet":covering,"requestsCoalesced":coalesced}})
    }
}
