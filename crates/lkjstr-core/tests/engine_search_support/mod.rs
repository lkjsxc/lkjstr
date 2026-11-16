#![allow(dead_code, clippy::unwrap_used, clippy::panic)]
use lkjstr_core::engine::{Engine, protocol, wire};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

pub fn pubkey(author: u8) -> String {
    SecretKey::from_bytes([author; 32]).unwrap().public_key()
}
pub fn event(author: u8, kind: u16, at: u64, text: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    let key = SecretKey::from_bytes([author; 32]).unwrap();
    serde_json::from_value(
        serde_json::to_value(
            UnsignedEvent::new(key.public_key(), at, kind, tags, text)
                .sign(&key, &[author; 32])
                .unwrap(),
        )
        .unwrap(),
    )
    .unwrap()
}
pub fn profile(author: u8, at: u64, name: &str, display: &str, nip05: &str) -> NostrEvent {
    event(
        author,
        0,
        at,
        &json!({"name":name,"display_name":display,"nip05":nip05}).to_string(),
        vec![],
    )
}
pub fn note(author: u8, at: u64) -> NostrEvent {
    event(author, 1, at, "alice blue note", vec![])
}
pub struct Fixture {
    pub engine: Engine,
    pub session: wire::Session,
    pub rows: Vec<Value>,
    pub messages: Vec<Value>,
    pub native_messages: Vec<Value>,
    pub now: u64,
}
impl Fixture {
    pub fn new(events: Vec<NostrEvent>) -> Self {
        let mut engine = Engine::new();
        for event in events {
            engine.store.insert(event, None);
        }
        Self {
            engine,
            session: Default::default(),
            rows: vec![],
            messages: vec![],
            native_messages: vec![],
            now: 1_800_000_000_000,
        }
    }
    pub fn input(&mut self, value: Value) {
        let input = serde_json::from_value(value).unwrap();
        for input in self.session.input(input, &self.engine).unwrap() {
            self.engine.input(input, self.now);
        }
        self.draw();
    }
    pub fn open(&mut self, account: u8) {
        self.input(json!({"t":"open","sub":"s","query":{
            "source":"search","account":pubkey(account),"text":"alice blue"
        }}));
        self.input(json!({"t":"window","sub":"s","anchor":"top","before":0,"after":3}));
    }
    pub fn draw(&mut self) {
        let outputs = self.engine.drain();
        for output in outputs {
            self.native_messages
                .push(serde_json::to_value(&output).unwrap());
            for message in self.session.output(output, &self.engine) {
                let message = serde_json::to_value(message).unwrap();
                self.apply(&message);
                self.messages.push(message);
            }
        }
    }
    fn apply(&mut self, message: &Value) {
        if message["sub"] != "s" {
            return;
        }
        if message["t"] == "rows" {
            self.rows = message["rows"].as_array().unwrap().clone();
        }
        if message["t"] != "patch" {
            return;
        }
        for op in message["ops"].as_array().unwrap() {
            match op["op"].as_str().unwrap() {
                "remove" => self.rows.retain(|row| row["key"] != op["key"]),
                "update" => {
                    let at = self
                        .rows
                        .iter()
                        .position(|row| row["key"] == op["row"]["key"])
                        .unwrap();
                    self.rows[at] = op["row"].clone();
                }
                "insert" => {
                    let incoming = op["rows"].as_array().unwrap();
                    self.rows
                        .retain(|row| !incoming.iter().any(|next| row["key"] == next["key"]));
                    let at = self
                        .rows
                        .iter()
                        .position(|row| row["key"] == op["before"])
                        .unwrap_or(self.rows.len());
                    self.rows.splice(at..at, incoming.iter().cloned());
                }
                _ => panic!("unexpected patch operation"),
            }
        }
    }
    pub fn change(&mut self, event: NostrEvent) {
        self.now += 100;
        self.engine.enqueue("wss://fixture.test/".into(), event);
        self.engine.tick(self.now);
        self.draw();
    }
    pub fn people(&self) -> Vec<&Value> {
        self.rows
            .iter()
            .filter(|row| row["kind"] == "person")
            .collect()
    }
    pub fn notes(&self) -> Vec<&str> {
        self.rows
            .iter()
            .filter(|row| row["kind"] == "note")
            .map(|row| row["id"].as_str().unwrap())
            .collect()
    }
    pub fn fresh(&self) -> u64 {
        self.messages
            .iter()
            .rev()
            .find(|m| m["t"] == "fresh" && m["sub"] == "s")
            .unwrap()["count"]
            .as_u64()
            .unwrap()
    }
    pub fn timeline(&mut self) -> Value {
        let mut last = Value::Null;
        for step in 0..100 {
            for message in self
                .session
                .timeline_tick(&self.engine, self.now + step * 25)
            {
                let value = serde_json::to_value(message).unwrap();
                if value["sub"] == "s" {
                    last = value["timeline"].clone();
                }
            }
        }
        last
    }
    pub fn anchor(&mut self, key: String) -> Option<String> {
        let inputs = self
            .session
            .input(
                serde_json::from_value(json!({
                    "t":"window","sub":"s","anchor":{"key":key},"before":0,"after":1
                }))
                .unwrap(),
                &self.engine,
            )
            .unwrap();
        inputs
            .into_iter()
            .find_map(|input| match input {
                protocol::Input::Window { anchor, .. } => Some(anchor),
                _ => None,
            })
            .unwrap()
    }
}
