//! Deterministic signed public fixtures. This module never opens a connection.
use lkjstr_core::{
    engine::{
        protocol::{Query, Source},
        query,
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, finalize_event, matches_filter, parse_secret_key_hex,
};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub const AUTHORS: usize = 300;
pub const RELAYS: usize = 32;
pub const START: u64 = 1_800_000_000_000;
pub const HORIZON: u64 = 30_000;
pub type Failure = Box<dyn std::error::Error>;

pub struct Relay {
    pub url: String,
    pub events: Vec<usize>,
    pub latency: u64,
    pub limit: usize,
    pub refuses: bool,
}
pub struct Fixture {
    pub relays: Vec<Relay>,
    pub events: Vec<NostrEvent>,
    pub context: Vec<NostrEvent>,
    pub queries: Vec<(String, Query)>,
    pub wanted: BTreeSet<String>,
    pub eligible: BTreeMap<String, BTreeSet<String>>,
    pub screens: BTreeMap<String, BTreeSet<String>>,
    pub fingerprint: String,
}
fn signed(
    person: usize,
    at: u64,
    kind: u64,
    tags: Vec<Vec<String>>,
    content: String,
) -> Result<NostrEvent, Failure> {
    let key =
        parse_secret_key_hex(&format!("{:064x}", person + 1)).ok_or("invalid fixture scalar")?;
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            tags,
            content,
        },
        &key,
    )
    .map_err(|_| "fixture signing failed".into())
}
fn url(index: usize) -> String {
    format!("wss://r{index:02}.test/")
}

impl Fixture {
    pub fn new() -> Result<Self, Failure> {
        let owner = signed(
            AUTHORS,
            START / 1000 - 1000,
            0,
            vec![],
            r#"{"name":"Fixture reader"}"#.into(),
        )?;
        let mut events = vec![];
        let mut context = vec![owner.clone()];
        for person in 0..AUTHORS {
            let tags = if person % 13 == 0 {
                vec![vec!["p".into(), owner.pubkey.clone()]]
            } else {
                vec![]
            };
            let event = signed(
                person,
                START / 1000 - 1 - person as u64,
                1,
                tags,
                format!("Deterministic public fixture note {person}"),
            )?;
            let routes = if person < 100 {
                [2, 4]
            } else if person < 200 {
                [2, 3]
            } else {
                [3, 5]
            };
            context.push(signed(
                person,
                START / 1000 - 1000,
                10002,
                routes
                    .into_iter()
                    .map(|r| vec!["r".into(), url(r), "write".into()])
                    .collect(),
                String::new(),
            )?);
            context.push(signed(
                person,
                START / 1000 - 1000,
                0,
                vec![],
                format!(r#"{{"name":"Fixture person {person}"}}"#),
            )?);
            events.push(event);
        }
        context.push(signed(
            AUTHORS,
            START / 1000 - 1000,
            3,
            events
                .iter()
                .map(|e| vec!["p".into(), e.pubkey.clone()])
                .collect(),
            String::new(),
        )?);
        let relays: Vec<_> = (0usize..RELAYS)
            .map(|i| Relay {
                url: url(i),
                events: match i {
                    0..=2 => (0..200).collect(),
                    3 => (100..300).collect(),
                    _ => ((i * 7) % 300..((i * 7) % 300 + 40).min(300)).collect(),
                },
                latency: if i < 2 {
                    1200
                } else {
                    100 + i.saturating_sub(3) as u64 * 70
                },
                limit: if i < 4 { 200 } else { 40 },
                refuses: i % 7 == 6,
            })
            .collect();
        let mut queries = vec![
            (
                "home".into(),
                Query {
                    source: Source::Home,
                    account: Some(owner.pubkey.clone()),
                    ..Default::default()
                },
            ),
            (
                "notifications".into(),
                Query {
                    source: Source::Notifications,
                    account: Some(owner.pubkey.clone()),
                    ..Default::default()
                },
            ),
        ];
        for person in [0, 100, 250] {
            queries.push((
                format!("profile-{person}"),
                Query {
                    source: Source::Profile,
                    account: Some(owner.pubkey.clone()),
                    target: Some(events[person].pubkey.clone()),
                    ..Default::default()
                },
            ));
        }
        let mut complete = Store::new(8000);
        for event in context.iter().chain(&events) {
            complete.insert(event.clone(), None);
        }
        let mut eligible = BTreeMap::new();
        let mut screens = BTreeMap::new();
        let mut wanted = BTreeSet::new();
        for (name, spec) in &queries {
            let selected = query::events(&complete, spec);
            let ids: BTreeSet<_> = selected.iter().map(|e| e.id.clone()).collect();
            screens.insert(
                name.clone(),
                selected.iter().take(10).map(|e| e.id.clone()).collect(),
            );
            wanted.extend(ids.iter().cloned());
            eligible.insert(name.clone(), ids);
        }
        let mut digest = Sha256::new();
        for event in context.iter().chain(&events) {
            digest.update(event.id.as_bytes());
        }
        for relay in &relays {
            digest.update(format!(
                "{}:{:?}:{}:{}:{}",
                relay.url, relay.events, relay.latency, relay.limit, relay.refuses
            ));
        }
        digest.update(serde_json::to_vec(&queries)?);
        Ok(Self {
            relays,
            events,
            context,
            queries,
            wanted,
            eligible,
            screens,
            fingerprint: format!("{:x}", digest.finalize()),
        })
    }
    pub fn store(&self) -> Store {
        let mut store = Store::new(8000);
        for event in &self.context {
            store.insert(event.clone(), None);
        }
        store
    }
    pub fn relay(&self, url: &str) -> Result<&Relay, Failure> {
        self.relays
            .iter()
            .find(|r| r.url == url)
            .ok_or_else(|| "unknown fixture relay".into())
    }
    pub fn answer(&self, relay: &Relay, filters: &[NostrFilter]) -> Vec<NostrEvent> {
        let held: Vec<_> = relay
            .events
            .iter()
            .map(|i| &self.events[*i])
            .chain(self.context.iter())
            .collect();
        let mut result = BTreeMap::new();
        for filter in filters {
            let mut matching: Vec<_> = held
                .iter()
                .copied()
                .filter(|event| matches_filter(event, filter))
                .collect();
            matching.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
            let limit = filter
                .limit
                .unwrap_or(relay.limit as u64)
                .min(relay.limit as u64);
            for event in matching.into_iter().take(limit as usize) {
                result
                    .entry(event.id.clone())
                    .or_insert_with(|| event.clone());
            }
        }
        let mut result: Vec<_> = result.into_values().collect();
        result.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
        result
    }
}
