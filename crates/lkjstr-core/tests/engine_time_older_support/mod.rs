use crate::engine_review_support::{accept, output};
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    wire::{RelayConfig, Session},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};

pub const A: &str = "ws://127.0.0.1:19101/";
pub const B: &str = "ws://127.0.0.1:19102/";
pub const AT: u64 = 100_999;

pub fn sign(
    key: &SecretKeyBytes,
    kind: u64,
    at: u64,
    content: &str,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            tags,
            content: content.into(),
        },
        key,
    )
    .unwrap()
}

pub struct RelayFixture {
    pub engine: Engine,
    session: Session,
    pub now: u64,
    frames: Vec<(String, Value)>,
    reports: Vec<Value>,
}

impl RelayFixture {
    pub fn new(relays: &[&str]) -> Self {
        let mut engine = Engine::new();
        engine
            .configure_relays(
                relays
                    .iter()
                    .map(|url| RelayConfig {
                        url: (*url).into(),
                        read: true,
                        search: false,
                        write: false,
                    })
                    .collect(),
                200_000,
            )
            .unwrap();
        for relay in relays {
            engine.network.relay_information(
                relay,
                r#"{"supported_nips":[1],"limitation":{"max_limit":3,"max_filters":4}}"#,
            );
        }
        Self {
            engine,
            session: Session::default(),
            now: 200_000,
            frames: vec![],
            reports: vec![],
        }
    }

    pub fn input(&mut self, message: Value) {
        accept(&mut self.session, &mut self.engine, message, self.now);
        self.drain();
    }

    pub fn open(&mut self, sub: &str, owner: &NostrEvent) {
        self.input(json!({"t":"open","sub":sub,"visible":false,"query":{
            "source":"their-home","pubkey":owner.pubkey,"since":80_001
        }}));
    }

    pub fn seek(&mut self, sub: &str, at: u64, before: usize, after: usize) {
        self.input(
            json!({"t":"window","sub":sub,"anchor":{"at":at},"before":before,"after":after}),
        );
    }

    pub fn hint(&mut self, subs: &[&str]) {
        self.input(
            json!({"t":"hint","hint":{"visibleSubs":subs,"pageHidden":false,"saveData":false}}),
        );
    }

    pub fn receive(&mut self, relay: &str, frame: Value) {
        if let Some(event) = self
            .engine
            .network
            .message(relay, &frame.to_string(), self.now)
        {
            self.engine.enqueue(relay.into(), event);
        }
    }

    pub fn page(&mut self, relay: &str, wire: &Value, events: &[&NostrEvent]) {
        for event in events {
            self.receive(relay, json!(["EVENT", wire, event]));
        }
        self.receive(relay, json!(["EOSE", wire]));
    }

    pub fn tick(&mut self, elapsed: u64) {
        self.now += elapsed;
        self.engine.tick(self.now);
        self.drain();
    }

    fn drain(&mut self) {
        loop {
            let effects = self.engine.network.drain_effects();
            if effects.is_empty() {
                break;
            }
            for effect in effects {
                match effect {
                    Effect::Connect(relay) => self.engine.network.connected(&relay, self.now),
                    Effect::Send(relay, frame) => self
                        .frames
                        .push((relay, serde_json::from_str(&frame).unwrap())),
                    _ => {}
                }
            }
        }
        self.reports
            .extend(output(&mut self.session, &mut self.engine));
    }

    pub fn requests(&self, relay: &str, kind: u64) -> Vec<&Value> {
        self.frames
            .iter()
            .filter_map(|(url, frame)| {
                (url == relay
                    && frame[0] == "REQ"
                    && frame.as_array().unwrap()[2..].iter().any(|f| {
                        f["kinds"][0] == kind && (kind == 3 || f.get("authors").is_some())
                    }))
                .then_some(frame)
            })
            .collect()
    }

    pub fn request(&self, relay: &str, kind: u64) -> Value {
        let requests = self.requests(relay, kind);
        assert!(
            !requests.is_empty(),
            "missing kind {kind} request on {relay}; frames: {:?}",
            self.frames
        );
        (*requests.last().unwrap()).clone()
    }

    pub fn closed(&self, relay: &str, request: &Value) -> bool {
        self.frames
            .iter()
            .any(|(url, frame)| url == relay && frame == &json!(["CLOSE", request[1]]))
    }

    pub fn report(&self, sub: &str) -> &Value {
        self.reports
            .iter()
            .rfind(|out| out["t"] == "timeWindow" && out["sub"] == sub)
            .unwrap()
    }

    pub fn rows(&self, sub: &str) -> Vec<String> {
        self.reports
            .iter()
            .rfind(|out| out["t"] == "rows" && out["sub"] == sub)
            .unwrap()["rows"]
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["key"].as_str().unwrap().into())
            .collect()
    }
}

pub fn fixtures() -> (SecretKeyBytes, NostrEvent, [NostrEvent; 6]) {
    let actor = generate_secret_key();
    let [tie_a, tie_b, overlap, deep, newer, stale] = [
        (100, "tie-a"),
        (100, "tie-b"),
        (96, "overlap"),
        (91, "deep"),
        (101, "newer"),
        (92, "stale"),
    ]
    .map(|(at, label)| sign(&actor, 1, at, label, vec![]));
    let owner = generate_secret_key();
    let list = sign(
        &owner,
        3,
        110,
        "",
        vec![vec!["p".into(), tie_a.pubkey.clone()]],
    );
    (owner, list, [tie_a, tie_b, overlap, deep, newer, stale])
}
