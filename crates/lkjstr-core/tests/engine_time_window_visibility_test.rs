#![allow(clippy::expect_used, clippy::unwrap_used)]
mod engine_review_support;

use engine_review_support::event;
use lkjstr_core::engine::{Engine, clients::Clients, wire::Session};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::{Value, json};
use std::collections::BTreeMap;

#[derive(Default)]
struct Shared {
    engine: Engine,
    clients: Clients,
    sessions: BTreeMap<u64, Session>,
}

impl Shared {
    fn connect(&mut self) -> u64 {
        let id = self.clients.connect(30_000).unwrap();
        self.sessions.insert(id, Session::default());
        id
    }

    fn send(&mut self, id: u64, message: Value) {
        let wire = serde_json::from_value(message).unwrap();
        for input in self
            .sessions
            .get_mut(&id)
            .unwrap()
            .input(wire, &self.engine)
            .unwrap()
        {
            for routed in self.clients.input(id, input, 30_000) {
                self.engine.input(routed, 30_000);
            }
        }
    }

    fn drain(&mut self) -> BTreeMap<u64, Vec<Value>> {
        let mut delivered = BTreeMap::<u64, Vec<Value>>::new();
        for output in self.engine.drain() {
            for (id, routed) in self.clients.output(output) {
                let wire = self
                    .sessions
                    .get_mut(&id)
                    .unwrap()
                    .output(routed, &self.engine);
                delivered.entry(id).or_default().extend(
                    wire.into_iter()
                        .map(|out| serde_json::to_value(out).unwrap()),
                );
            }
        }
        delivered
    }
}

fn rows(messages: &[Value]) -> &[Value] {
    let rows = messages.iter().find(|m| m["t"] == "rows").unwrap();
    assert_eq!(rows["sub"], "moment");
    rows["rows"].as_array().unwrap()
}

#[test]
fn shared_covered_repost_keeps_its_pivot_time_through_show_and_hide() {
    let mut shared = Shared::default();
    let reader = shared.connect();
    let neighbor = shared.connect();
    let original = event(4, 1, "body https://example.invalid/picture.png", vec![]);
    let older = event(9, 1, "older", vec![]);
    let newer = event(15, 1, "newer", vec![]);
    let target = || vec![vec!["e".into(), original.id.clone()]];
    let repost = event(25, 6, "", target());
    let outside_repost = event(28, 6, "", target());
    let owner = event(
        30,
        3,
        "",
        [&repost, &older, &newer]
            .iter()
            .map(|row| vec!["p".into(), row.pubkey.clone()])
            .collect(),
    );
    let mute = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 21,
            kind: 10_000,
            tags: vec![vec!["p".into(), original.pubkey.clone()]],
            content: String::new(),
        },
        &generate_secret_key(),
    )
    .unwrap();
    for note in [
        &owner,
        &mute,
        &original,
        &repost,
        &outside_repost,
        &older,
        &newer,
    ] {
        shared.engine.store.insert(note.clone(), None);
    }
    let open = json!({"t":"open","sub":"moment","query":{
        "source":"their-home","pubkey":owner.pubkey,"account":mute.pubkey
    }});
    shared.send(reader, open.clone());
    shared.send(neighbor, open);
    let opening = shared.drain();
    let assert_ordinary = |messages: &[Value]| {
        let rows = rows(messages);
        assert!(!rows.is_empty());
        assert!(rows.iter().all(|row| row.get("readingAt").is_none()));
    };
    assert_ordinary(&opening[&reader]);
    assert_ordinary(&opening[&neighbor]);

    let seek = json!({
        "t":"window","sub":"moment","anchor":{"at":10_000},"before":2,"after":1
    });
    shared.send(reader, seek.clone());
    let routed = shared.drain();
    let messages = &routed[&reader];
    let selected = rows(messages);
    assert_eq!(
        selected
            .iter()
            .map(|row| row["key"].as_str().unwrap())
            .collect::<Vec<_>>(),
        [&original.id, &newer.id, &older.id]
    );
    let report = messages.iter().find(|m| m["t"] == "timeWindow").unwrap();
    assert_eq!(report["sub"], "moment");
    assert_eq!(report["key"], older.id);
    assert!(
        routed
            .get(&neighbor)
            .into_iter()
            .flatten()
            .all(|message| !matches!(message["t"].as_str(), Some("rows" | "timeWindow")))
    );

    let assert_slot = |row: &Value| {
        assert_eq!(row["key"], original.id);
        assert_eq!(row["at"], 4_000);
        assert_eq!(row["readingAt"], 25_000);
    };
    let assert_covered = |row: &Value| {
        assert_slot(row);
        assert_eq!(row["hidden"]["reason"], "muted-person");
        assert_eq!(row["segments"], json!([]));
        assert_eq!(row["media"], json!([]));
        assert!(row.get("repostedBy").is_none());
        assert!(!row.to_string().contains(&repost.pubkey));
        assert!(!row.to_string().contains(&outside_repost.pubkey));
    };
    assert_covered(&selected[0]);

    for show in [true, false] {
        let messages: Vec<_> = shared
            .sessions
            .get_mut(&reader)
            .unwrap()
            .note_reveal(
                "choice".into(),
                "moment",
                &original.id,
                show,
                &shared.engine,
            )
            .into_iter()
            .map(|out| serde_json::to_value(out).unwrap())
            .collect();
        let patch = messages.iter().find(|m| m["t"] == "patch").unwrap();
        let update = &patch["ops"][0]["row"];
        if show {
            assert_slot(update);
            assert_eq!(update["revealed"]["reason"], "muted-person");
            assert_eq!(
                update["media"][0]["url"],
                "https://example.invalid/picture.png"
            );
            shared.send(reader, seek.clone());
            let repeated = shared.drain();
            let shown = &rows(&repeated[&reader])[0];
            assert_slot(shown);
            assert_eq!(shown["revealed"]["reason"], "muted-person");
        } else {
            assert_covered(update);
        }
    }
    let top = json!({"t":"window","sub":"moment","anchor":"top","before":0,"after":10});
    shared.send(neighbor, top.clone());
    assert_ordinary(&shared.drain()[&neighbor]);
    shared.send(reader, top);
    assert_ordinary(&shared.drain()[&reader]);
}
