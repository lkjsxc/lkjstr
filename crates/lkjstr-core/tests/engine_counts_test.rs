#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    wire::{Input, Output, Session},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
fn signed(kind: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: "fixture".into(),
            tags,
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
fn rows(e: &mut Engine, query: Value) -> Vec<Value> {
    let mut s = Session::default();
    for i in s
        .input(
            serde_json::from_value::<Input>(json!({"t":"open","sub":"test","query":query}))
                .expect("input"),
            e,
        )
        .expect("supported")
    {
        e.input(i, 100);
    }
    e.drain()
        .into_iter()
        .flat_map(|o| s.output(o, e))
        .filter_map(|o| match o {
            Output::Rows { rows, .. } => Some(rows),
            _ => None,
        })
        .flatten()
        .collect()
}
#[test]
fn unqueried_and_arriving_counts_do_not_claim_a_relay_limit() {
    let mut e = Engine::new();
    let note = signed(1, vec![]);
    e.store.insert(note.clone(), None);
    let first = rows(&mut e, json!({"source":"global"}));
    for field in ["replies", "reposts", "reactions", "zaps"] {
        assert_eq!(first[0]["counts"][field], 0);
        assert!(first[0]["counts"].get("estimates").is_none());
        assert_eq!(first[0]["counts"]["partial"], false);
    }
    for kind in [1, 6, 7] {
        e.store.insert(
            signed(
                kind,
                vec![vec!["e".into(), note.id.clone(), "".into(), "reply".into()]],
            ),
            None,
        );
    }
    let result = rows(&mut e, json!({"source":"global","authors":[note.pubkey]}));
    for field in ["replies", "reposts", "reactions"] {
        assert_eq!(result[0]["counts"][field], 1);
        assert_eq!(result[0]["counts"]["partial"], false);
    }
}
#[test]
fn profile_empty_follow_list_is_exact_zero_but_missing_list_is_unknown() {
    let mut e = Engine::new();
    let contact = signed(3, vec![]);
    let p = contact.pubkey.clone();
    let before = rows(&mut e, json!({"source":"profile","pubkey":p}));
    for field in ["following", "followers", "notes"] {
        assert!(before[0].get(field).is_none());
    }
    e.store.insert(contact, None);
    let after = rows(&mut e, json!({"source":"profile","pubkey":p}));
    assert_eq!(after[0]["following"], 0);
    assert_eq!(after[0]["partial"], false);
    assert!(after[0].get("followers").is_none());
}
#[test]
fn exact_counts_require_all_routes_untruncated_verified_and_successful() {
    use lkjstr_core::{
        engine::{
            network::{Effect, Network},
            protocol::Query,
        },
        store::Store,
    };
    use lkjstr_protocol::NostrFilter;
    let relay = "wss://counts.test/";
    let mut filter = NostrFilter {
        kinds: Some(vec![1, 6, 7, 9735]),
        limit: Some(200),
        ..Default::default()
    };
    filter.tags.insert("e".into(), vec!["a".repeat(64)]);
    for outcome in ["empty", "closed", "timeout", "truncated"] {
        let mut n = Network::default();
        let mut store = Store::new(200);
        n.configure(vec![relay.into()], 0);
        n.relay_information(relay, r#"{"limitation":{"max_limit":1}}"#);
        n.plan(
            vec![("counts".into(), filter.clone(), Query::default())],
            &lkjstr_core::store::Store::new(0),
            0,
        );
        n.connected(relay, 0);
        let frames: Vec<Value> = n
            .drain_effects()
            .into_iter()
            .filter_map(|f| match f {
                Effect::Send(_, s) => serde_json::from_str(&s).ok(),
                _ => None,
            })
            .collect();
        let id = frames.iter().find(|f| f[0] == "REQ").expect("request")[1].clone();
        assert!(!n.count_complete(&filter, &store));
        assert!(!n.count_limited(&filter));
        if outcome == "truncated" {
            let event = signed(7, vec![vec!["e".into(), "a".repeat(64)]]);
            n.message(relay, &json!(["EVENT", id, event]).to_string(), 1);
            store.insert(event, None);
        }
        match outcome {
            "closed" => {
                n.message(
                    relay,
                    &json!(["CLOSED", id, "blocked: fixture"]).to_string(),
                    2,
                );
            }
            "timeout" => n.tick(15001),
            _ => {
                n.message(relay, &json!(["EOSE", id]).to_string(), 2);
            }
        }
        assert_eq!(
            n.count_complete(&filter, &store),
            outcome == "empty",
            "{outcome}"
        );
        assert_eq!(
            n.count_limited(&filter),
            outcome == "truncated",
            "{outcome}"
        );
        n.verifying = true;
        assert!(!n.count_complete(&filter, &store));
    }
}
#[test]
fn full_count_requests_patch_the_visible_note_with_a_lower_bound() {
    use lkjstr_core::engine::network::Effect;
    let mut e = Engine::new();
    let relay = "wss://counts.test/";
    e.network.configure(vec![relay.into()], 0);
    e.network
        .relay_information(relay, r#"{"limitation":{"max_limit":1}}"#);
    let note = signed(1, vec![]);
    e.store.insert(note.clone(), Some(relay));
    let mut s = Session::default();
    let input: Input = serde_json::from_value(
        json!({"t":"open","sub":"feed","query":{"source":"global","account":note.pubkey}}),
    )
    .expect("open");
    for input in s.input(input, &e).expect("supported") {
        e.input(input, 0);
    }
    let initial: Vec<_> = e
        .drain()
        .into_iter()
        .flat_map(|o| s.output(o, &e))
        .collect();
    assert!(initial.iter().any(
        |o| matches!(o,Output::Rows{rows,..} if rows.iter().any(|r|r["counts"]["partial"]==false))
    ));
    e.network.connected(relay, 1);
    let mut limited = false;
    for now in (100..2000).step_by(100) {
        let frames: Vec<Value> = e
            .network
            .drain_effects()
            .into_iter()
            .filter_map(|f| match f {
                Effect::Send(_, s) => serde_json::from_str(&s).ok(),
                _ => None,
            })
            .collect();
        for frame in frames.iter().filter(|f| f[0] == "REQ") {
            if frame.as_array().expect("frame").iter().skip(2).any(|f| {
                f["#e"]
                    .as_array()
                    .is_some_and(|ids| ids.contains(&json!(note.id)))
            }) {
                let reaction = signed(7, vec![vec!["e".into(), note.id.clone()]]);
                e.network.message(
                    relay,
                    &json!(["EVENT", frame[1], reaction]).to_string(),
                    now,
                );
                e.store.insert(reaction, None);
            }
            e.network
                .message(relay, &json!(["EOSE", frame[1]]).to_string(), now);
        }
        e.tick(now);
        for output in e.drain().into_iter().flat_map(|o| s.output(o, &e)) {
            if let Output::Patch { ops, .. } = output {
                limited |= ops.iter().any(|o| {
                    o["op"] == "update"
                        && o["row"]["id"] == note.id
                        && o["row"]["counts"]["partial"] == true
                });
            }
        }
    }
    assert!(limited, "a count-only completion must update the row");
}
