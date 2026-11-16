#![allow(clippy::expect_used)]
mod engine_emoji_support;
use engine_emoji_support::*;
use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::generate_secret_key;
use serde_json::json;

#[test]
fn only_a_verified_owner_list_can_start_set_discovery() {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let pack = set(&generate_secret_key(), 20, "pack", "wave");
    let list = signed(
        &generate_secret_key(),
        30,
        10030,
        vec![tag(&["a", &address(&pack)])],
    );
    open(&mut s, &mut e, &list.pubkey);
    let (_, req) = frames(&mut e)
        .into_iter()
        .find(|(_, f)| f[0] == "REQ" && f[2]["kinds"] == json!([10030]))
        .expect("owner list");
    let wire = req[1].as_str().expect("wire");
    let mut invalid = list.clone();
    invalid.content = "unsigned change".into();
    reply(&mut e, RELAY, wire, &invalid, 100_100);
    e.tick(100_200);
    assert_eq!(e.rejected, 1);
    assert!(
        !frames(&mut e)
            .iter()
            .any(|(_, f)| f[0] == "REQ" && f[2]["kinds"] == json!([30030]))
    );
    reply(&mut e, RELAY, wire, &list, 100_300);
    eose(&mut e, RELAY, wire, 100_301);
    assert!(
        !frames(&mut e)
            .iter()
            .any(|(_, f)| f[0] == "REQ" && f[2]["kinds"] == json!([30030]))
    );
    e.tick(100_400);
    assert!(frames(&mut e).iter().any(|(_, f)| f[0] == "REQ"
        && f[2]["kinds"] == json!([30030])
        && f[2]["authors"] == json!([pack.pubkey])));
}

#[test]
fn replacing_owner_membership_cancels_the_removed_address_even_with_a_late_response() {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let owner = generate_secret_key();
    let pack = set(&generate_secret_key(), 20, "pack", "wave");
    let list = signed(&owner, 30, 10030, vec![tag(&["a", &address(&pack)])]);
    e.store.insert(list.clone(), None);
    open(&mut s, &mut e, &list.pubkey);
    frames(&mut e);
    e.tick(100_100);
    let (_, req) = frames(&mut e)
        .into_iter()
        .find(|(_, f)| f[0] == "REQ" && f[2]["kinds"] == json!([30030]))
        .expect("set lookup");
    let newer = signed(&owner, 40, 10030, vec![]);
    e.enqueue("cache".into(), newer);
    e.tick(100_200);
    assert!(
        frames(&mut e)
            .iter()
            .any(|(_, f)| f == &json!(["CLOSE", req[1]]))
    );
    reply(
        &mut e,
        RELAY,
        req[1].as_str().expect("wire"),
        &pack,
        100_300,
    );
    e.tick(100_400);
    assert!(e.store.get(&pack.id).is_none());
    assert!(
        snapshot(&mut s, &mut e, 100_500)["rows"]
            .as_array()
            .expect("rows")
            .is_empty()
    );
}

#[test]
fn references_have_strict_kind_author_identifier_and_nonrecursive_bounds() {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let maker = set(&generate_secret_key(), 20, "pack", "wave");
    let mut tags = vec![
        tag(&["a", &format!("30000:{}:wrong", maker.pubkey)]),
        tag(&["a", "30030:bad:wrong"]),
        tag(&["a", &format!("30030:{}:", maker.pubkey)]),
        tag(&["a", &format!("30030:{}:{}", maker.pubkey, "x".repeat(257))]),
        tag(&["a", &address(&maker)]),
        tag(&["a", &address(&maker)]),
    ];
    for i in 1..40 {
        tags.push(tag(&["a", &format!("30030:{}:set{i}", maker.pubkey)]));
    }
    let list = signed(&generate_secret_key(), 30, 10030, tags);
    e.store.insert(list.clone(), None);
    open(&mut s, &mut e, &list.pubkey);
    let mut requested = Vec::new();
    for now in (100_000..110_000).step_by(100) {
        e.tick(now);
        for (relay, frame) in frames(&mut e) {
            if frame[0] == "REQ" {
                for filter in frame.as_array().expect("REQ").iter().skip(2) {
                    if filter["kinds"] == json!([30030]) {
                        requested.push(filter["#d"][0].as_str().expect("identifier").to_owned());
                    }
                }
                eose(&mut e, &relay, frame[1].as_str().expect("wire"), now + 1);
            }
        }
    }
    requested.sort();
    requested.dedup();
    assert_eq!(requested.len(), 32);
    assert!(requested.iter().any(|s| s == "pack"));
    assert!(
        !requested
            .iter()
            .any(|s| s == "wrong" || s.is_empty() || s == "set32")
    );
}

#[test]
fn a_relay_hint_is_scoped_to_its_selected_set_and_invalid_hints_are_ignored() {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let pack = set(&generate_secret_key(), 20, "pack", "wave");
    let hint = "wss://set-hint.test/";
    let list = signed(
        &generate_secret_key(),
        30,
        10030,
        vec![tag(&["a", &address(&pack), hint])],
    );
    e.store.insert(list.clone(), None);
    open(&mut s, &mut e, &list.pubkey);
    e.network.connected(hint, 100_100);
    let hinted: Vec<_> = frames(&mut e)
        .into_iter()
        .filter(|(r, f)| r == hint && f[0] == "REQ")
        .collect();
    assert!(!hinted.is_empty());
    assert!(
        hinted.iter().all(
            |(_, f)| f[2]["kinds"] == json!([30030]) && f[2]["authors"] == json!([pack.pubkey])
        )
    );
    assert_eq!(
        e.relay_rows()
            .into_iter()
            .find(|r| r["url"] == hint)
            .expect("hint row")["read"],
        false
    );
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let list = signed(
        &generate_secret_key(),
        30,
        10030,
        vec![tag(&[
            "a",
            &address(&pack),
            "wss://user:password@invalid.test/",
        ])],
    );
    e.store.insert(list.clone(), None);
    open(&mut s, &mut e, &list.pubkey);
    assert_eq!(e.network.relays.len(), 1);
}
