//! Bounded relay scheduler. Time is supplied by the host, including in tests.
use super::protocol::{Output, Query, Source};
use lkjstr_protocol::{NostrEvent, NostrFilter, filter_to_value, normalize_relay_url};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
#[path = "network_lifecycle.rs"]
mod lifecycle;
#[path = "network_messages.rs"]
mod messages;
#[path = "network_tick.rs"]
mod scheduler;
#[derive(Debug, Clone)]
pub enum Effect {
    Inspect(String),
    Connect(String),
    Disconnect(String),
    Send(String, String),
}
#[derive(Default)]
pub struct Relay {
    pub online: bool,
    pub connecting: bool,
    pub last_rx: u64,
    pub retry_at: u64,
    pub failures: u32,
    pub received: u64,
    pub useful: u64,
    pub sent: u64,
    pub max_reqs: usize,
    pub max_limit: u64,
    pub nip11: bool,
    pub next_req_at: u64,
    pub latency_ms: Option<u64>,
}
pub(super) struct Request {
    pub relay: String,
    pub filter: NostrFilter,
    pub members: BTreeSet<String>,
    pub sent: bool,
    pub eose: bool,
    pub deadline: u64,
    pub last_event: Option<u64>,
    pub sent_at: u64,
    pub last_rx: u64,
    pub complete: bool,
    pub live: bool,
    pub asked: bool,
    pub ready_at: u64,
    // At most the transmitted page limit (<= 200) distinct IDs.
    pub received: BTreeSet<String>,
    pub page_limit: usize,
    pub oldest: Option<u64>,
    pub retry_delay: u64,
}
pub(super) struct Publication {
    pub req: String,
    pub event: NostrEvent,
    pub deadline: u64,
    pub deliveries: BTreeMap<String, String>,
    pub sent: BTreeSet<String>,
}
#[derive(Default)]
pub struct Network {
    pub relays: BTreeMap<String, Relay>,
    pub relay_order: Vec<String>,
    pub known: BTreeMap<String, super::wire::RelayConfig>,
    pub(super) requests: BTreeMap<String, Request>,
    pub(super) effects: Vec<Effect>,
    pub(super) output: Vec<Output>,
    pub(super) publications: BTreeMap<String, Publication>,
    next: u64,
    pub verifying: bool,
    pub(super) reported: BTreeMap<String, String>,
}
impl Network {
    pub fn configure(&mut self, urls: Vec<String>, now: u64) {
        self.relay_order = urls
            .iter()
            .filter_map(|u| normalize_relay_url(u))
            .take(8)
            .collect();
        let urls: BTreeSet<_> = urls
            .iter()
            .filter_map(|u| normalize_relay_url(u))
            .take(8)
            .collect();
        let removed: Vec<_> = self
            .relays
            .keys()
            .filter(|u| !urls.contains(*u))
            .cloned()
            .collect();
        for r in removed {
            self.effects.push(Effect::Disconnect(r.clone()));
            self.relays.remove(&r);
        }
        for url in urls {
            self.known
                .entry(url.clone())
                .or_insert(super::wire::RelayConfig {
                    url: url.clone(),
                    read: true,
                    write: true,
                    search: true,
                });
            if !self.relays.contains_key(&url) {
                self.effects.push(Effect::Inspect(url.clone()));
            }
            self.relays.entry(url).or_insert(Relay {
                retry_at: now,
                max_reqs: 4,
                max_limit: 200,
                ..Default::default()
            });
        }
    }
    pub fn plan(&mut self, wants: Vec<(String, NostrFilter, Query)>, now: u64) {
        self.reported
            .retain(|sub, _| wants.iter().any(|(id, _, _)| id == sub));
        let mut ranked: Vec<_> = self.relays.iter().collect();
        ranked.sort_by_key(|(url, r)| {
            (
                std::cmp::Reverse(r.useful.saturating_sub(r.failures as u64)),
                *url,
            )
        });
        let preferred: Vec<_> = ranked.into_iter().map(|(u, _)| u.clone()).collect();
        if self.relays.is_empty() {
            for (sub, _, _) in &wants {
                if self.reported.get(sub).is_none_or(|s| s != "error") {
                    self.output.push(Output::Status {
                        sub: sub.clone(),
                        state: "error".into(),
                        asked_relays: 0,
                        answered_relays: 0,
                    });
                    self.reported.insert(sub.clone(), "error".into());
                }
            }
        }
        let mut desired: BTreeMap<(String, String), (NostrFilter, BTreeSet<String>)> =
            BTreeMap::new();
        for (sub, f, q) in wants {
            let routes: Vec<String> = if q.source == Source::Relay {
                q.target
                    .into_iter()
                    .filter(|r| self.relays.contains_key(r))
                    .collect()
            } else {
                preferred
                    .iter()
                    .filter(|u| {
                        self.known.get(*u).is_none_or(|r| {
                            if q.source == Source::Search {
                                r.search
                            } else {
                                r.read
                            }
                        })
                    })
                    .take(2)
                    .cloned()
                    .collect()
            };
            for r in routes {
                let key = (r, filter_to_value(&f).to_string());
                let entry = desired.entry(key).or_insert((f.clone(), BTreeSet::new()));
                entry.1.insert(sub.clone());
            }
        }
        let mut retained = BTreeSet::new();
        for ((relay, _key), (filter, members)) in desired {
            let existing = self
                .requests
                .iter_mut()
                .find(|(_, r)| r.relay == relay && r.filter == filter);
            if let Some((id, r)) = existing {
                r.members = members;
                retained.insert(id.clone());
            } else {
                self.next += 1;
                let id = format!("e{}", self.next);
                retained.insert(id.clone());
                self.requests.insert(
                    id,
                    Request {
                        relay,
                        filter: filter.clone(),
                        members,
                        sent: false,
                        eose: false,
                        deadline: u64::MAX,
                        last_event: None,
                        sent_at: 0,
                        last_rx: now,
                        complete: false,
                        live: filter_live(&filter),
                        asked: false,
                        ready_at: now,
                        received: BTreeSet::new(),
                        page_limit: 200,
                        oldest: None,
                        retry_delay: 1000,
                    },
                );
            }
        }
        let obsolete: Vec<_> = self
            .requests
            .keys()
            .filter(|id| !retained.contains(*id))
            .cloned()
            .collect();
        for id in obsolete {
            if let Some(r) = self.requests.remove(&id)
                && r.sent
            {
                self.send(&r.relay, json!(["CLOSE", id]));
            }
        }
        self.tick(now);
    }
    fn send(&mut self, relay: &str, value: Value) {
        if let Some(r) = self.relays.get_mut(relay) {
            r.sent += 1;
        }
        self.effects
            .push(Effect::Send(relay.into(), value.to_string()));
    }
    pub fn drain_effects(&mut self) -> Vec<Effect> {
        std::mem::take(&mut self.effects)
    }
    pub fn drain_output(&mut self) -> Vec<Output> {
        std::mem::take(&mut self.output)
    }
    pub fn stats(&self) -> Value {
        json!(self.relays.iter().map(|(url,r)|json!({"url":url,"online":r.online,
        "lastRx":r.last_rx,"received":r.received,"useful":r.useful,"sent":r.sent,"failures":r.failures,
        "nip11":r.nip11,"maxReqs":r.max_reqs,"latencyMs":r.latency_ms,
        "activeReqs":self.requests.values().filter(|q|q.relay==*url && q.sent).count()})).collect::<Vec<_>>())
    }
}

fn filter_live(f: &NostrFilter) -> bool {
    f.ids.is_none()
        && f.until.is_none()
        && f.kinds
            .as_ref()
            .is_some_and(|ks| ks.iter().any(|k| matches!(k, 1 | 6 | 7 | 9735)))
}
