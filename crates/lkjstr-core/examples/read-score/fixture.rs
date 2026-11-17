//! Public signed deterministic loopback data, separate from the planner.
use lkjstr_core::engine::protocol::{Filters, Query, Source};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};
pub const START: u64 = 1_800_000_000_000;
pub struct Fixture {
    pub relays: Vec<String>,
    pub seed: Vec<NostrEvent>,
    pub events: Vec<NostrEvent>,
    pub authors: Vec<String>,
    pub queries: Vec<(String, Query)>,
    pub trace: Value,
}
fn key(n: u32) -> SecretKey {
    let mut bytes = [0; 32];
    bytes[28..].copy_from_slice(&n.to_be_bytes());
    SecretKey::from_bytes(bytes).expect("fixture key")
}
fn signed(n: u32, at: u64, kind: u16, tags: Vec<Vec<String>>, text: &str) -> NostrEvent {
    let key = key(n);
    let e = UnsignedEvent::new(key.public_key(), at, kind, tags, text)
        .sign(&key, &[0; 32])
        .expect("fixture signature");
    serde_json::from_value(serde_json::to_value(e).expect("signed value")).expect("protocol event")
}
fn tag(k: &str, v: &str) -> Vec<String> {
    vec![k.into(), v.into()]
}
impl Fixture {
    pub fn new() -> Self {
        let relays: Vec<_> = (0..32).map(|n| format!("wss://r{n:02}.test/")).collect();
        let authors: Vec<_> = (1..=300).map(|n| key(n).public_key()).collect();
        let owner = key(999).public_key();
        let at = START / 1000 - 1000;
        let target = signed(999, at, 1, vec![], "fixture own note");
        let mut seed = vec![
            target.clone(),
            signed(
                999,
                at,
                3,
                authors.iter().map(|p| tag("p", p)).collect(),
                "",
            ),
        ];
        let mut events = Vec::new();
        for (i, author) in authors.iter().enumerate() {
            let n = i as u32 + 1;
            seed.push(signed(
                n,
                at,
                0,
                vec![],
                &json!({"name":format!("Person {i}")}).to_string(),
            ));
            let pair = if i < 100 {
                [2, 4]
            } else if i < 200 {
                [2, 3]
            } else {
                [3, 5]
            };
            seed.push(signed(
                n,
                at,
                10002,
                pair.into_iter()
                    .map(|r| vec!["r".into(), relays[r].clone(), "write".into()])
                    .collect(),
                "",
            ));
            let event = signed(
                n,
                at + 100 + i as u64,
                1,
                vec![],
                &format!("Public note {i}"),
            );
            if i < 40 {
                seed.push(event.clone());
            }
            events.push(event);
            if i % 10 == 0 {
                events.push(signed(
                    n,
                    at + 500 + i as u64,
                    7,
                    vec![tag("e", &target.id), tag("p", &owner)],
                    "+",
                ));
            }
            assert_eq!(key(n).public_key(), *author);
        }
        let mut queries = vec![
            (
                "home".into(),
                Query {
                    source: Source::Home,
                    account: Some(owner.clone()),
                    ..Default::default()
                },
            ),
            (
                "notifications".into(),
                Query {
                    source: Source::Notifications,
                    account: Some(owner.clone()),
                    ..Default::default()
                },
            ),
        ];
        for (n, i) in [5, 151, 250].into_iter().enumerate() {
            queries.push((
                format!("profile{n}"),
                Query {
                    source: Source::Profile,
                    account: Some(owner.clone()),
                    target: Some(authors[i].clone()),
                    filters: Filters::default(),
                },
            ));
        }
        // A deterministic replay trace; it is not falsely described as observed human history.
        let days: Vec<_> = (0..7).map(|day| json!({"day":day,"actions":[
            {"at":0,"action":"open","views":["home","notifications","profile0","profile1","profile2"]},
            {"at":2500,"action":"focus","view":format!("profile{}",day%3)},
            {"at":4000,"action":"reading","view":"home"},
            {"at":6000,"action":"hide","view":"profile2"},
            {"at":8000,"action":"show","view":"profile2"},
            {"at":10000,"action":"close","view":"profile0"},
            {"at":12000,"action":"reopen","view":"profile0"}
        ]})).collect();
        Self {
            relays,
            seed,
            events,
            authors,
            queries,
            trace: json!({"kind":"deterministic-week-replay","days":days}),
        }
    }
    pub fn holds(&self, relay: &str, event: &NostrEvent) -> bool {
        let r = self
            .relays
            .iter()
            .position(|u| u == relay)
            .expect("fixture relay");
        let Some(a) = self.authors.iter().position(|p| *p == event.pubkey) else {
            return true;
        };
        match r {
            0..=2 => a < 200,
            3 => a >= 100,
            4 => a < 100,
            5 => a >= 200,
            _ => a >= (r * 7) % 300 && a < ((r * 7) % 300 + 40).min(300),
        }
    }
    pub fn latency(&self, relay: &str) -> u64 {
        let r = self
            .relays
            .iter()
            .position(|u| u == relay)
            .expect("fixture relay");
        if r < 2 {
            1200
        } else {
            100 + r.saturating_sub(3) as u64 * 70
        }
    }
}
