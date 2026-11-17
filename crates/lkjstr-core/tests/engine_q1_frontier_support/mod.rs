#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, SecretKeyBytes, VerificationResult, finalize_event,
    generate_secret_key, verify_event,
};
use serde_json::{Value, json};
pub const RELAY: &str = "wss://q1-frontier.test/";
pub const NOW: u64 = 200_000;

pub fn frames(network: &mut Network) -> Vec<Value> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("wire frame")),
            _ => None,
        })
        .collect()
}
pub struct Fixture {
    pub network: Network,
    pub store: Store,
    pub broad: NostrFilter,
    pub narrow: NostrFilter,
    pub initial: Value,
    pub events: Vec<NostrEvent>,
}
impl Fixture {
    pub fn new() -> Self {
        let a = generate_secret_key();
        let b = generate_secret_key();
        let events = vec![
            signed(&a, 100),
            signed(&b, 99),
            signed(&b, 90),
            signed(&a, 1),
        ];
        let mut authors = vec![events[0].pubkey.clone(), events[1].pubkey.clone()];
        authors.sort();
        let broad = NostrFilter {
            authors: Some(authors),
            kinds: Some(vec![1, 6]),
            until: Some(200),
            limit: Some(200),
            ..Default::default()
        };
        let narrow = NostrFilter {
            authors: Some(vec![events[0].pubkey.clone()]),
            ..broad.clone()
        };
        let store = Store::new(100);
        let mut network = Network::default();
        network.configure(vec![RELAY.into()], NOW);
        network.relay_information(
            RELAY,
            r#"{"limitation":{"max_filters":2,"max_subscriptions":4,"max_limit":2}}"#,
        );
        network.plan(
            vec![
                ("broad".into(), broad.clone(), Query::default()),
                ("narrow".into(), narrow.clone(), Query::default()),
            ],
            &store,
            NOW,
        );
        network.connected(RELAY, NOW + 1);
        let requests: Vec<_> = frames(&mut network)
            .into_iter()
            .filter(|frame| frame[0] == "REQ")
            .collect();
        assert_eq!(requests.len(), 1);
        let initial = requests[0].clone();
        assert_eq!(initial.as_array().expect("shared envelope").len(), 4);
        assert!(
            initial.as_array().expect("filters")[2..]
                .iter()
                .all(|filter| filter["limit"] == 2)
        );
        Self {
            network,
            store,
            broad,
            narrow,
            initial,
            events,
        }
    }
    pub fn receive(&mut self, wire: &Value, index: usize, now: u64) {
        let event = self.events[index].clone();
        let received = self
            .network
            .message(RELAY, &json!(["EVENT", wire, event]).to_string(), now)
            .expect("matching fixture event");
        assert!(matches!(verify_event(&received), VerificationResult::Ok(_)));
        self.network.event(RELAY, &received, now);
        self.store.insert(received, None);
    }
    pub fn finish(&mut self, wire: &Value, now: u64) {
        self.network
            .message(RELAY, &json!(["EOSE", wire]).to_string(), now);
    }
    pub fn plan(&mut self, broad: NostrFilter, keep_narrow: bool, now: u64) {
        let mut wants = vec![("broad".into(), broad, Query::default())];
        if keep_narrow {
            wants.push(("narrow".into(), self.narrow.clone(), Query::default()));
        }
        self.network.plan(wants, &self.store, now);
    }
}
fn signed(key: &SecretKeyBytes, created_at: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at,
            kind: 1,
            content: "Q1 frontier fixture".into(),
            tags: vec![],
        },
        key,
    )
    .expect("signed event")
}
