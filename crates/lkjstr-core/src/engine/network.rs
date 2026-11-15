//! Bounded relay scheduler. Time is supplied by the host, including in tests.
use super::protocol::{Output, Query, Source};
use lkjstr_protocol::{NostrEvent, NostrFilter, filter_to_value, normalize_relay_url};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
#[path = "network_config.rs"]
mod configuration;
#[path = "network_lifecycle.rs"]
mod lifecycle;
#[path = "network_lists.rs"]
mod lists;
#[path = "network_messages.rs"]
mod messages;
#[path = "network_stats.rs"]
mod observations;
#[path = "network_profiles.rs"]
mod profiles;
#[path = "network_publications.rs"]
mod publications;
#[path = "network_tick.rs"]
mod scheduler;
use scheduler::filter_live;
type Desired = BTreeMap<(String, String), (NostrFilter, BTreeSet<String>)>;
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
    pub duplicates: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub connected_since: Option<u64>,
    pub last_error: Option<String>,
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
    pub page_eose: bool, // Historical completion survives live resubscription.
    pub deadline: u64,
    pub last_event: Option<u64>,
    pub sent_at: u64,
    pub last_rx: u64,
    pub complete: bool,
    pub live: bool,
    pub list_watch: bool, // Visible TheirHome watch, even when shared with account discovery.
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
    pub(super) profiles_changed: bool,
    pub verifying: bool,
    pub(super) reported: BTreeMap<String, String>,
}
impl Network {
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
        let live_lists = lists::views(&wants);
        let mut desired = Desired::new();
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
                    .take(if matches!(q.source, Source::Channel | Source::Channels) {
                        24
                    } else {
                        2
                    })
                    .cloned()
                    .collect()
            };
            let mut routes = routes;
            routes.extend(
                q.filters
                    .relay_hints
                    .iter()
                    .filter(|u| self.relays.contains_key(*u))
                    .cloned(),
            );
            routes.sort();
            routes.dedup();
            for r in routes {
                let key = (r, filter_to_value(&f).to_string());
                let entry = desired.entry(key).or_insert((f.clone(), BTreeSet::new()));
                entry.1.insert(sub.clone());
            }
        }
        self.stabilize_profiles(&mut desired);
        let mut retained = BTreeSet::new();
        for ((relay, _key), (filter, members)) in desired {
            let list_watch = lists::watch(&filter, &members, &live_lists);
            let live = filter_live(&filter) || members.contains("~account-discovery") || list_watch;
            let existing = self
                .requests
                .iter_mut()
                .find(|(_, r)| r.relay == relay && r.filter == filter);
            if let Some((id, r)) = existing {
                let close = r.watch_list(live, now);
                r.list_watch = list_watch;
                let relay = r.relay.clone();
                let id = id.clone();
                r.refresh_profile(&members, now);
                r.members = members;
                retained.insert(id.clone());
                if close {
                    self.send(&relay, json!(["CLOSE", id]));
                }
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
                        page_eose: false,
                        deadline: u64::MAX,
                        last_event: None,
                        sent_at: 0,
                        last_rx: now,
                        complete: false,
                        live,
                        list_watch,
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
            r.bytes_out += value.to_string().len() as u64;
        }
        self.effects
            .push(Effect::Send(relay.into(), value.to_string()));
    }
}
