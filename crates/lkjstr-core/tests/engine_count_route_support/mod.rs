//! Synthetic count-stream fixtures; no sockets, public data or clocks.
#![allow(clippy::expect_used, dead_code)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, VerificationResult, finalize_event,
    parse_secret_key_hex, verify_event,
};
use serde_json::{Value, json};
pub const A: &str = "wss://a.test/";
pub const B: &str = "wss://b.test/";
pub const C: &str = "wss://c.test/";
pub const START: u64 = 1_800_000_000_000;
pub type Frame = (String, Value);

pub fn targets() -> Vec<String> {
    (1..=3).map(|i| format!("{i:064x}")).collect()
}
pub fn filter(ids: Vec<String>) -> NostrFilter {
    let mut filter = NostrFilter {
        kinds: Some(vec![1, 6, 7, 9735]),
        limit: Some(200),
        ..Default::default()
    };
    filter.tags.insert("e".into(), ids);
    filter
}
pub fn frames(n: &mut Network) -> Vec<Frame> {
    n.drain_effects()
        .into_iter()
        .filter_map(|effect| {
            let Effect::Send(relay, raw) = effect else {
                return None;
            };
            Some((
                relay,
                serde_json::from_str(&raw).expect("synthetic wire frame"),
            ))
        })
        .collect()
}
pub fn requests(values: &[Frame]) -> Vec<Frame> {
    values
        .iter()
        .filter(|(_, frame)| frame[0] == "REQ")
        .cloned()
        .collect()
}
pub fn counts(frame: &Value) -> bool {
    frame[0] == "REQ" && frame[2]["kinds"] == json!([1, 6, 7, 9735])
}
pub fn plan(n: &mut Network, store: &Store, filter: &NostrFilter, at: u64) {
    n.plan(
        vec![("feed".into(), filter.clone(), Query::default())],
        store,
        at,
    );
}
pub fn eose(n: &mut Network, relay: &str, frame: &Value, at: u64) {
    n.message(relay, &json!(["EOSE", frame[1]]).to_string(), at);
}
pub fn verified(n: &mut Network, store: &mut Store, relay: &str, event: &NostrEvent, at: u64) {
    assert!(matches!(verify_event(event), VerificationResult::Ok(_)));
    if store.get(&event.id).is_some() {
        n.observe_verified(relay, event, at);
    } else {
        n.event(relay, event, at);
    }
    store.insert(event.clone(), Some(relay));
}
pub fn prefer_c(n: &mut Network) {
    for relay in [A, B] {
        let r = n.relays.get_mut(relay).expect("configured reader");
        r.received = 10_000;
        r.useful = 0;
        r.latency_ms = Some(90_000);
    }
    let r = n.relays.get_mut(C).expect("configured alternative");
    r.received = 100;
    r.useful = 100;
    r.latency_ms = Some(1);
}
pub struct Case {
    pub n: Network,
    pub store: Store,
    pub filter: NostrFilter,
    pub events: Vec<NostrEvent>,
}
impl Case {
    pub fn new(ids: Vec<String>, validate: bool) -> Self {
        let key = parse_secret_key_hex(&"07".repeat(32)).expect("synthetic fixture key");
        let events: Vec<_> = (0..200)
            .map(|i| {
                finalize_event(
                    &EventTemplate {
                        pubkey: None,
                        created_at: START / 1000 - 300 + i,
                        kind: 7,
                        content: "+".into(),
                        tags: vec![vec!["e".into(), ids[0].clone()]],
                    },
                    &key,
                )
                .expect("signed count fixture")
            })
            .collect();
        let mut n = Network::default();
        let mut store = Store::new(1000);
        n.configure(vec![A.into(), B.into(), C.into()], START);
        let filter = filter(ids);
        plan(&mut n, &store, &filter, START);
        n.connected(A, START + 1);
        n.connected(B, START + 1);
        n.tick(START + 100);
        let initial = requests(&frames(&mut n));
        assert_eq!(initial.len(), 2, "two initial count readers");
        assert!(
            initial
                .iter()
                .all(|(r, f)| [A, B].contains(&r.as_str()) && counts(f))
        );
        for (relay, frame) in initial {
            for event in &events {
                assert!(
                    n.message(
                        &relay,
                        &json!(["EVENT", frame[1], event]).to_string(),
                        START + 110
                    )
                    .is_some()
                );
                if validate {
                    verified(&mut n, &mut store, &relay, event, START + 111);
                }
            }
            eose(&mut n, &relay, &frame, START + 120);
        }
        n.verifying = !validate;
        assert!(
            frames(&mut n).is_empty(),
            "EOSE alone keeps live counts open"
        );
        Self {
            n,
            store,
            filter,
            events,
        }
    }
    pub fn replan(&mut self, at: u64) -> Vec<Frame> {
        plan(&mut self.n, &self.store, &self.filter, at);
        frames(&mut self.n)
    }
    pub fn expected_since(&self) -> u64 {
        self.events.last().expect("full count page").created_at - 2
    }
    pub fn reconnect_a(&mut self, at: u64) -> Vec<Frame> {
        self.n.disconnected(A, at);
        self.n.connected(A, at + 1);
        requests(&frames(&mut self.n))
    }
    pub fn profile_rotation(&mut self, serial: u64, at: u64) -> Vec<Frame> {
        self.n
            .known
            .get_mut(C)
            .expect("configured alternative")
            .read = false;
        for relay in [A, B] {
            self.n
                .relay_information(relay, r#"{"limitation":{"max_subscriptions":1}}"#);
        }
        let profile = NostrFilter {
            kinds: Some(vec![0]),
            authors: Some(vec![format!("{serial:064x}")]),
            limit: Some(1),
            ..Default::default()
        };
        self.n.plan(
            vec![
                ("feed".into(), self.filter.clone(), Query::default()),
                ("names".into(), profile, Query::default()),
            ],
            &self.store,
            at,
        );
        self.n.tick(at + 100);
        let hydration: Vec<_> = requests(&frames(&mut self.n))
            .into_iter()
            .filter(|(_, f)| f[2]["kinds"] == json!([0]))
            .collect();
        assert!(
            !hydration.is_empty(),
            "finite visible profiles receive a slot"
        );
        for (relay, req) in hydration {
            eose(&mut self.n, &relay, &req, at + 110);
        }
        self.n.tick(at + 1_200);
        requests(&frames(&mut self.n))
            .into_iter()
            .filter(|(_, f)| counts(f))
            .collect()
    }
}
