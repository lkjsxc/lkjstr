#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query, Source},
};
use serde_json::{Value, json};
use std::collections::BTreeSet;

#[test]
fn windows_request_counts_and_references_only_for_uncovered_notes() {
    let mut e = Engine::new();
    let visible_ref = "a".repeat(64);
    let hidden_ref = "b".repeat(64);
    let visible = event(1, 1, "visible", vec![vec!["q".into(), visible_ref.clone()]]);
    e.store.insert(visible.clone(), None);
    for at in 2..352 {
        e.store.insert(
            event(at, 1, "blocked", vec![vec!["q".into(), hidden_ref.clone()]]),
            None,
        );
    }
    let mute = event(400, 10000, "", vec![vec!["word".into(), "blocked".into()]]);
    let owner = mute.pubkey.clone();
    e.store.insert(mute, None);
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    open(
        &mut e,
        Query {
            source: Source::Search,
            account: Some(owner),
            ..Default::default()
        },
    );
    e.input(
        Input::Window {
            sub: "feed".into(),
            anchor: Some(visible.id.clone()),
            before: 20,
            after: 20,
        },
        1,
    );
    e.network.connected(RELAY, 1);
    let mut sent = Vec::new();
    for now in (100..=2000).step_by(100) {
        e.tick(now);
        let next = frames(&mut e);
        for frame in next.iter().filter(|f| f[0] == "REQ") {
            e.network
                .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now + 1);
        }
        sent.extend(next);
    }
    let filters: Vec<_> = sent
        .iter()
        .filter(|f| f[0] == "REQ")
        .flat_map(|f| f.as_array().expect("frame").iter().skip(2))
        .collect();
    let counts: BTreeSet<_> = filters
        .iter()
        .filter(|f| f["kinds"] == json!([1, 6, 7, 9735]))
        .flat_map(|f| {
            f["#e"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
        })
        .collect();
    assert_eq!(
        counts,
        BTreeSet::from([visible.id.as_str()]),
        "hidden rows must not create count streams"
    );
    let ids: BTreeSet<_> = filters
        .iter()
        .flat_map(|f| {
            f["ids"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
        })
        .collect();
    assert!(
        ids.contains(visible_ref.as_str()),
        "a window containing the visible note must hydrate its quote"
    );
    assert!(
        !ids.contains(hidden_ref.as_str()),
        "hidden quotes must not be fetched"
    );
    e.input(Input::Close { sub: "feed".into() }, 2100);
    assert_eq!(
        e.network.request_stats(),
        json!([]),
        "closing releases list requests"
    );
}
