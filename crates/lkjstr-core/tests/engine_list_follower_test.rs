#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::json;
#[test]
fn follower_person_anchor_reaches_history_after_a_full_cached_page() {
    let mut e = Engine::new();
    let target = "a".repeat(64);
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"followers","pubkey":target}}),
        0,
    );
    output(&mut s, &mut e);
    e.network.connected(RELAY, 1);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([3]))
        .expect("head");
    let mut anchor = String::new();
    for at in 100..300 {
        let row = event(at, 3, "", vec![vec!["p".into(), target.clone()]]);
        if at == 110 {
            anchor = row.pubkey.clone();
        }
        let row = e
            .network
            .message(RELAY, &json!(["EVENT", req[1], row]).to_string(), 2)
            .expect("event");
        e.network.event(RELAY, &row, 2);
        e.store.insert(row, Some(RELAY));
    }
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3);
    for now in 4..12 {
        e.tick(now);
    }
    frames(&mut e);
    output(&mut s, &mut e);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":anchor},"before":0,"after":60}),
        20,
    );
    e.network.connected(RELAY, 100);
    let mut sent = Vec::new();
    for now in [100, 200, 300] {
        e.tick(now);
        sent.extend(frames(&mut e));
    }
    assert!(
        sent.iter()
            .any(|f| f[0] == "REQ" && f[2]["kinds"] == json!([3]) && f[2]["until"] == 100)
    );
}
#[test]
fn follower_profiles_are_for_the_rows_not_their_unrelated_contacts() {
    let mut e = Engine::new();
    let target = "a".repeat(64);
    let unrelated = "b".repeat(64);
    let mut people = std::collections::BTreeSet::new();
    for at in 1..4 {
        let contact = event(
            at,
            3,
            "",
            vec![
                vec!["p".into(), target.clone()],
                vec!["p".into(), unrelated.clone()],
            ],
        );
        people.insert(contact.pubkey.clone());
        e.store.insert(contact, None);
    }
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"followers","pubkey":target}}),
        0,
    );
    e.network.connected(RELAY, 1);
    e.tick(100);
    let sent = frames(&mut e);
    let authors: std::collections::BTreeSet<_> = sent
        .iter()
        .filter(|f| f[0] == "REQ")
        .flat_map(|f| f.as_array().expect("frame").iter().skip(2))
        .filter(|f| f["kinds"] == json!([0]))
        .flat_map(|f| {
            f["authors"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|p| p.as_str().map(str::to_owned))
        })
        .collect();
    assert_eq!(authors, people);
}
