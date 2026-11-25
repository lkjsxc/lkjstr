//! Cheap bounded observations and upload defaults. No event bodies or keys.
use super::Engine;
use serde_json::{Value, json};
pub const MEDIA_SERVERS: [&str; 4] = [
    "https://blossom.band",
    "https://blossom.primal.net",
    "https://nostr.build",
    "https://nostrcheck.me",
];
pub const BLOSSOM_SERVERS: [&str; 3] = [MEDIA_SERVERS[0], MEDIA_SERVERS[1], MEDIA_SERVERS[3]];
/// Session-only evidence. Never restore reachability from disk.
#[derive(Default)]
pub struct ServerVerdict {
    pub protocol: String,
    pub generation: u64,
    pub ok: Option<bool>,
    pub error: Option<String>,
}
/// Optional BUD-06 failures are inconclusive; only required HTTP can fail a server.
pub enum ServerEvidence<'a> {
    Checking,
    Optional(bool),
    Required(Result<(), &'a str>),
}
impl Engine {
    pub fn observe_server(
        &mut self,
        url: &str,
        protocol: &str,
        evidence: ServerEvidence<'_>,
    ) -> u64 {
        use ServerEvidence::*;
        // Failure cannot establish a new protocol (including failed discovery).
        let protocol = if matches!(evidence, Required(Err(_))) {
            self.server_row(url)["protocol"]
                .as_str()
                .unwrap_or("unknown")
                .to_owned()
        } else {
            protocol.into()
        };
        let (ok, error) = match evidence {
            Checking | Optional(false) => (None, None),
            Optional(true) | Required(Ok(())) => (Some(true), None),
            Required(Err(code)) => (Some(false), Some(code.into())),
        };
        // At most 64 session observations, independent of persisted account/event data.
        if self.servers.len() >= 64
            && !self.servers.contains_key(url)
            && let Some(old) = self.servers.keys().next().cloned()
        {
            self.servers.remove(&old);
        }
        self.server_revision += 1;
        self.servers.insert(
            url.into(),
            ServerVerdict {
                protocol,
                generation: self.server_revision,
                ok,
                error,
            },
        );
        self.invalidate();
        self.server_revision
    }
    pub fn server_row(&self, url: &str) -> Value {
        let verdict = self.servers.get(url);
        let protocol =
            verdict
                .map(|v| v.protocol.as_str())
                .unwrap_or(if self.upload_is_nip96(url) {
                    "nip96"
                } else if BLOSSOM_SERVERS.contains(&url) {
                    "blossom"
                } else {
                    "unknown"
                });
        let mut row = json!({"kind":"server","key":url,"url":url,"protocol":protocol,
            "ok":verdict.and_then(|v|v.ok).unwrap_or(false),
            "checked":verdict.is_some_and(|v|v.ok.is_some())});
        if let Some(code) = verdict.and_then(|v| v.error.as_ref()) {
            row["error"] = json!({"code":code});
        }
        row
    }
    /// Try unknowns in list order; only fresh required-request failures are skipped.
    pub fn upload_candidates(
        &self,
        account: &str,
    ) -> Result<Vec<String>, super::upload::Unavailable> {
        let servers = self.upload_servers(account);
        let candidates: Vec<_> = servers
            .iter()
            .filter(|url| !self.servers.get(*url).is_some_and(|v| v.ok == Some(false)))
            .cloned()
            .collect();
        if !candidates.is_empty() {
            return Ok(candidates);
        }
        let server = servers.first().cloned();
        let code = server
            .as_ref()
            .and_then(|s| self.servers.get(s))
            .and_then(|v| v.error.clone())
            .unwrap_or_else(|| "not-found".into());
        Err(super::upload::Unavailable { code, server })
    }
    pub fn upload_is_nip96(&self, server: &str) -> bool {
        server.trim_end_matches('/') == MEDIA_SERVERS[2]
            || self
                .servers
                .get(server)
                .is_some_and(|v| v.protocol == "nip96")
    }
    /// An explicit kind 10063, including an empty list, overrides defaults.
    pub fn upload_servers(&self, account: &str) -> Vec<String> {
        self.store
            .replaceable(account, 10063)
            .map(|e| lkjstr_protocol::tags::tag_values(&e, "server"))
            .unwrap_or_else(|| MEDIA_SERVERS.iter().map(|s| (*s).into()).collect())
    }
    /// Never choose a default while the owner list lookup is still unresolved.
    pub fn upload_servers_ready(&self, account: &str) -> bool {
        self.store.replaceable(account, 10063).is_some()
            || self.network.list_loaded(&self.store, account, 10063)
    }
    pub fn stats(&self) -> Value {
        self.stats_at(self.network.now)
    }

    pub fn stats_at(&self, now: u64) -> Value {
        use super::telemetry::relay_error;
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
            let (label, private) = self.network.relay_display(url);
            let mut row = json!({"url":label,
                "cooldownRemainingMs":self.network.cooldown_remaining(url, now),
                "isPrivateHost":private,"state":if r.online {"connected"} else if r.connecting {"connecting"} else if r.failures>0 {"waiting"} else {"idle"},
                "connectedSince":r.connected_since,"eventsReceived":r.received,"duplicatesDropped":r.duplicates,
                "openSubscriptions":open_subscriptions.get(url.as_str()).copied().unwrap_or(0),
                "bytesIn":r.bytes_in,"bytesOut":r.bytes_out,"lastError":if self.network.deferred_relays.contains(url) {Some("capacity")} else {r.last_error.as_deref().map(relay_error)},"latencyMs":r.latency_ms});
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
        json!({"requests":self.network.stats_requests(),"recentPublications":self.network.stats_publications(),"relays":relays,
            "views":self.view_stats(),"worker":self.worker_stats(),
            "bandwidthHistory":self.network.telemetry.bandwidth(now),
            "orchestrationEvents":self.network.telemetry.decisions,"totals":{"eventsStored":self.store.len(),"cacheBytes":self.store.payload_bytes(),
            "subscriptions":subscriptions,"servedFromCache":self.metrics.served_from_cache,"servedFromNetwork":network},
            "orchestration":{"relaysCoveringFollowSet":covering,"requestsCoalesced":coalesced}})
    }
}
