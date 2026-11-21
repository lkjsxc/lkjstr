//! Press-only handler reads share one finite relay lookup per coordinate.
use super::{
    Engine,
    protocol::{Query, Source},
};
use crate::store::Store;
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{NostrFilter, client_handler_address};
use serde::Serialize;
use std::collections::BTreeMap;

const MAX_LOOKUPS: usize = 8;
const MAX_WAITERS_PER_LOOKUP: usize = 8;
const MAX_NEGATIVE: usize = 128;
const DEADLINE_MS: u64 = 6000;
const NEGATIVE_MS: u64 = 30_000;

#[derive(Clone, Debug, Serialize)]
pub struct Handler {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
}

pub struct Answer {
    pub client: u64,
    pub req: String,
    pub handler: Option<Handler>,
}

struct Pending {
    address: Coordinate,
    deadline: u64,
    waiters: Vec<(u64, String)>,
}

#[derive(Default)]
pub(super) struct Lookups {
    // MAX_LOOKUPS coordinates, MAX_WAITERS_PER_LOOKUP clients per coordinate.
    pending: BTreeMap<String, Pending>,
    // MAX_NEGATIVE short-lived misses. Verified positive and malformed events live in Store.
    misses: BTreeMap<String, u64>,
    // At most MAX_LOOKUPS * MAX_WAITERS_PER_LOOKUP completions per pump.
    answers: Vec<Answer>,
}

impl Engine {
    pub fn ask_client_info(
        &mut self,
        client: u64,
        req: String,
        address: &str,
        now: u64,
    ) -> Option<Answer> {
        let answer = |handler| {
            Some(Answer {
                client,
                req: req.clone(),
                handler,
            })
        };
        let Some(address) = client_handler_address(address) else {
            return answer(None);
        };
        let key = address.to_string();
        if let Some(pending) = self.client_info.pending.get_mut(&key) {
            if pending.waiters.len() >= MAX_WAITERS_PER_LOOKUP {
                return answer(None);
            }
            pending.waiters.push((client, req));
            return None;
        }
        if let Some(handler) = retained(&self.store, &address) {
            return answer(handler);
        }
        if self.client_info.pending.len() >= MAX_LOOKUPS
            || self
                .client_info
                .misses
                .get(&key)
                .is_some_and(|until| now < *until)
        {
            return answer(None);
        }
        self.client_info.pending.insert(
            key,
            Pending {
                address,
                deadline: now.saturating_add(DEADLINE_MS),
                waiters: vec![(client, req)],
            },
        );
        self.replan(now);
        None
    }

    pub fn detach_client_info(&mut self, client: u64, now: u64) {
        let before = self.client_info.pending.len();
        self.client_info.pending.retain(|_, entry| {
            entry.waiters.retain(|(id, _)| *id != client);
            !entry.waiters.is_empty()
        });
        self.client_info
            .answers
            .retain(|answer| answer.client != client);
        if self.client_info.pending.len() != before {
            self.replan(now);
        }
    }

    pub fn drain_client_info(&mut self) -> Vec<Answer> {
        std::mem::take(&mut self.client_info.answers)
    }

    pub(super) fn client_info_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        self.client_info
            .pending
            .iter()
            .map(|(key, entry)| {
                let mut filter = super::thread::address_filter(entry.address.clone());
                filter.limit = Some(8);
                let mut query = Query {
                    source: Source::Thread,
                    ..Default::default()
                };
                let relay = super::client_tag::RELAY;
                if key == super::client_tag::ADDRESS
                    && (!self.network.relay_order.iter().any(|url| url == relay)
                        || self
                            .network
                            .known
                            .get(relay)
                            .is_some_and(|usage| usage.read))
                {
                    query.filters.relay_hints.push(relay.into());
                }
                (owner(key), filter, query)
            })
            .collect()
    }

    pub(super) fn settle_client_info(&mut self, now: u64) {
        if self.client_info.pending.is_empty() {
            return;
        }
        let finished: Vec<_> = self
            .client_info
            .pending
            .iter()
            .filter(|(key, entry)| now >= entry.deadline || self.client_info_finished(key))
            .map(|(key, _)| key.clone())
            .collect();
        if finished.is_empty() {
            return;
        }
        for key in finished {
            let Some(entry) = self.client_info.pending.remove(&key) else {
                continue;
            };
            let handler = retained(&self.store, &entry.address).flatten();
            if handler.is_none() {
                self.client_info.remember_miss(key, now);
            }
            self.client_info
                .answers
                .extend(entry.waiters.into_iter().map(|(client, req)| Answer {
                    client,
                    req,
                    handler: handler.clone(),
                }));
        }
        self.replan(now);
    }

    fn client_info_finished(&self, key: &str) -> bool {
        if self.network.verifying {
            return false;
        }
        let owner = owner(key);
        let mut requests = self
            .network
            .requests
            .values()
            .filter(|request| request.members.contains(&owner))
            .peekable();
        requests.peek().is_some() && requests.all(|request| request.complete || request.eose)
    }
}

impl Lookups {
    fn remember_miss(&mut self, key: String, now: u64) {
        self.misses.retain(|_, until| *until > now);
        if self.misses.len() >= MAX_NEGATIVE
            && let Some(oldest) = self
                .misses
                .iter()
                .min_by_key(|(_, until)| *until)
                .map(|(key, _)| key.clone())
        {
            self.misses.remove(&oldest);
        }
        self.misses.insert(key, now.saturating_add(NEGATIVE_MS));
    }
}

fn owner(key: &str) -> String {
    format!("@client-info:{key}")
}

// The store admits verified events only. Select the newest exact kind, author
// and first d value before parsing content, so invalid metadata cannot revive an old revision.
fn retained(store: &Store, address: &Coordinate) -> Option<Option<Handler>> {
    let event = store.addressed(address)?;
    let count = event
        .tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|key| key == "d"))
        .count();
    Some((count == 1).then(|| handler(&event.content)).flatten())
}

fn handler(content: &str) -> Option<Handler> {
    let info: serde_json::Value = serde_json::from_str(content).ok()?;
    let name = info.get("name")?.as_str()?.chars().filter(|ch| {
        !ch.is_control() && !matches!(ch, '\u{061c}' | '\u{200b}'..='\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2060}'..='\u{206f}' | '\u{feff}')
    }).collect::<String>();
    let name: String = name.trim().chars().take(128).collect();
    if name.is_empty() {
        return None;
    }
    let website = info
        .get("website")
        .and_then(serde_json::Value::as_str)
        .and_then(safe_website);
    Some(Handler { name, website })
}

fn safe_website(text: &str) -> Option<String> {
    if text.len() > 2048 || text.chars().any(char::is_control) {
        return None;
    }
    let url = url::Url::parse(text).ok()?;
    (matches!(url.scheme(), "http" | "https")
        && url.has_host()
        && url.username().is_empty()
        && url.password().is_none())
    .then(|| url.to_string())
}
