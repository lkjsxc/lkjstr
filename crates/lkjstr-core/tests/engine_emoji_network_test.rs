#![allow(clippy::expect_used)]
mod engine_emoji_support;
use engine_emoji_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire};
use lkjstr_protocol::generate_secret_key;
use serde_json::{Value, json};

fn set_request(engine: &mut Engine, now: u64) -> (String, Value) {
    let mut found = None;
    for time in (now..now + 3000).step_by(100) {
        engine.tick(time);
        for (relay, frame) in frames(engine) {
            if frame[0] != "REQ" {
                continue;
            }
            if frame
                .as_array()
                .expect("REQ")
                .iter()
                .skip(2)
                .any(|f| f["kinds"] == json!([30030]))
            {
                found = Some((relay, frame));
            }
        }
        if found.is_some() {
            break;
        }
    }
    found.expect("referenced set must be requested")
}
fn fixture() -> (
    Engine,
    wire::Session,
    lkjstr_protocol::NostrEvent,
    lkjstr_protocol::NostrEvent,
) {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let set = set(&generate_secret_key(), 20, "animals", "cat");
    let list = signed(
        &generate_secret_key(),
        30,
        10030,
        vec![tag(&["a", &address(&set)])],
    );
    e.store.insert(list.clone(), None);
    open(&mut s, &mut e, &list.pubkey);
    (e, s, list, set)
}

#[test]
fn discovery_is_exact_and_verified_arrival_updates_existing_wire_rows() {
    let (mut e, mut s, _, set) = fixture();
    let initial = output(&mut s, &mut e);
    assert!(
        initial
            .iter()
            .any(|m| m["t"] == "rows" && m["atBottom"] == false)
    );
    let (relay, req) = set_request(&mut e, 100_100);
    let filters = req.as_array().expect("request");
    let filter = filters
        .iter()
        .skip(2)
        .find(|f| f["kinds"] == json!([30030]))
        .expect("set filter");
    assert_eq!(
        filter,
        &json!({"kinds":[30030],"authors":[set.pubkey],"#d":["animals"],"limit":1})
    );
    let wire = req[1].as_str().expect("wire");
    let mut forged = set.clone();
    forged.content = "changed without a signature".into();
    reply(&mut e, &relay, wire, &forged, 100_400);
    e.tick(100_500);
    assert_eq!(e.rejected, 1);
    assert!(
        snapshot(&mut s, &mut e, 100_550)["rows"]
            .as_array()
            .expect("rows")
            .is_empty()
    );
    reply(&mut e, &relay, wire, &set, 100_600);
    eose(&mut e, &relay, wire, 100_601);
    // Raw EOSE cannot expose unverified emoji or finish an empty picker.
    assert_eq!(snapshot(&mut s, &mut e, 100_650)["atBottom"], false);
    e.tick(100_700);
    let shown = snapshot(&mut s, &mut e, 100_800);
    assert_eq!(shown["rows"][0]["code"], "cat");
    assert_eq!(shown["atBottom"], true);
}

#[test]
fn hide_and_close_release_pending_set_wants_and_reject_late_frames() {
    let (mut e, mut s, _, set) = fixture();
    let (relay, req) = set_request(&mut e, 100_100);
    let wire = req[1].as_str().expect("wire");
    e.input(
        Input::Hint {
            visible_subs: vec![],
            focused_sub: None,
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        100_400,
    );
    assert!(
        frames(&mut e)
            .iter()
            .any(|(_, f)| f == &json!(["CLOSE", wire]))
    );
    reply(&mut e, &relay, wire, &set, 100_500);
    e.tick(100_600);
    assert!(e.store.get(&set.id).is_none());
    e.input(
        Input::Hint {
            visible_subs: vec!["emoji".into()],
            focused_sub: None,
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        100_700,
    );
    // Hiding released the socket; the fixture must deliver the new transport callback.
    e.network.connected(RELAY, 100_800);
    let (_, next) = set_request(&mut e, 100_800);
    assert_ne!(next[1], req[1]);
    accept(&mut s, &mut e, json!({"t":"close","sub":"emoji"}), 101_000);
    assert!(
        frames(&mut e)
            .iter()
            .any(|(_, f)| f == &json!(["CLOSE", next[1]]))
    );
}

#[test]
fn failed_or_unverified_set_is_not_completed_empty_but_eose_without_events_is() {
    let (mut e, mut s, _, _) = fixture();
    let (relay, req) = set_request(&mut e, 100_100);
    e.network.message(
        &relay,
        &json!(["CLOSED", req[1], "refused"]).to_string(),
        100_400,
    );
    e.tick(100_500);
    assert_eq!(snapshot(&mut s, &mut e, 100_600)["atBottom"], false);
    let (mut e, mut s, _, _) = fixture();
    let (relay, req) = set_request(&mut e, 100_100);
    eose(&mut e, &relay, req[1].as_str().expect("wire"), 100_400);
    e.tick(100_500);
    assert_eq!(snapshot(&mut s, &mut e, 100_600)["atBottom"], true);
}
