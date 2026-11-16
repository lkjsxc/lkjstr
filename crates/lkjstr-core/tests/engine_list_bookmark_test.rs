#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::{Value, json};
#[test]
fn private_bookmark_ids_keep_every_lookup_batch() {
    let mut e = Engine::new();
    let keys: Vec<_> = (1..=250).map(|i| format!("{i:064x}")).collect();
    let list = event(1, 10003, "encrypted", vec![]);
    let owner = list.pubkey.clone();
    e.private_lists.insert(
        list.id.clone(),
        keys.iter().map(|id| vec!["e".into(), id.clone()]).collect(),
    );
    e.store.insert(list, None);
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
        json!({"t":"open","sub":"feed","query":{"source":"bookmarks","account":owner}}),
        0,
    );
    e.network.connected(RELAY, 1);
    let mut sent = Vec::new();
    for now in [100, 200, 300, 400, 500, 600, 700, 800] {
        e.tick(now);
        let next = frames(&mut e);
        for frame in next.iter().filter(|f| f[0] == "REQ") {
            e.network
                .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now + 1);
        }
        sent.extend(next);
    }
    let ids: std::collections::BTreeSet<_> = sent
        .iter()
        .filter(|f| f[0] == "REQ")
        .flat_map(|f| f.as_array().expect("frame").iter().skip(2))
        .flat_map(|f| {
            f["ids"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
        })
        .collect();
    assert!(keys.iter().all(|id| ids.contains(id.as_str())));
}
#[test]
fn bookmark_hydration_matches_tag_order_and_decrypted_rows() {
    let mut e = Engine::new();
    let a = event(100, 1, "public", vec![]);
    let b = event(1, 1, "private", vec![]);
    let list = event(
        200,
        10003,
        "encrypted",
        vec![vec!["e".into(), a.id.clone()]],
    );
    let owner = list.pubkey.clone();
    e.private_lists.insert(
        list.id.clone(),
        vec![
            vec!["e".into(), b.id.clone()],
            vec!["e".into(), a.id.clone()],
        ],
    );
    for row in [&a, &b, &list] {
        e.store.insert(row.clone(), None);
    }
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"bookmarks","account":owner}}),
        0,
    );
    let out = output(&mut s, &mut e);
    let rows = out.iter().find(|o| o["t"] == "rows").expect("rows")["rows"]
        .as_array()
        .expect("rows");
    assert_eq!(
        rows.iter()
            .map(|r| r["id"].as_str().expect("id"))
            .collect::<Vec<_>>(),
        [a.id.as_str(), b.id.as_str()]
    );
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":b.id},"before":0,"after":1}),
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
                .filter_map(Value::as_str)
        })
        .collect();
    assert!(authors.contains(b.pubkey.as_str()));
    assert!(!authors.contains(a.pubkey.as_str()));
}
