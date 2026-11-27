#![allow(clippy::expect_used)]
#[path = "engine_pins/network.rs"]
mod fixture;
#[path = "engine_pins/support.rs"]
mod support;
use lkjstr_core::engine::{Engine, protocol::Output, wire::Session};
use serde_json::json;
use support::*;

#[test]
fn a_received_list_keeps_missing_targets_pending_even_when_the_read_is_live() {
    let mut f = fixture::pending();
    let state = fixture::state(&f.outputs);
    assert_eq!(state["phase"], "live");
    assert_eq!(state["pins"], json!({"pending":1,"unavailable":0}));
    let waiting = f
        .outputs
        .iter()
        .rfind(|msg| msg["t"] == "rows")
        .expect("waiting rows");
    assert_eq!(waiting["atBottom"], false);
    let out = fixture::resolve(&mut f);
    assert_eq!(
        fixture::state(&out)["pins"],
        json!({"pending":0,"unavailable":0})
    );
    assert!(out.iter().any(|msg| {
        msg["t"] == "rows"
            && msg["rows"].as_array().is_some_and(|rows| {
                rows.iter()
                    .any(|row| row["id"] == f.note.id && row["pinned"] == true)
            })
    }));
    // A resolved old pin joins ordinary author/context hydration.
    f.engine.tick(NOW + 800);
    let sent = frames(&mut f.engine);
    assert!(sent.iter().any(|frame| {
        frame[0] == "REQ"
            && frame[2]["kinds"] == json!([0])
            && frame[2]["authors"]
                .as_array()
                .is_some_and(|authors| authors.iter().any(|author| author == &f.note.pubkey))
    }));
}

#[test]
fn an_empty_target_lookup_reports_unavailable_instead_of_an_empty_pin_list() {
    let mut f = fixture::pending();
    eose(&mut f.engine, RELAY, &f.note_request, NOW + 600);
    f.engine.tick(NOW + 700);
    let out = output(&mut f.session, &mut f.engine);
    let state = fixture::state(&out);
    assert_eq!(state["pins"], json!({"pending":0,"unavailable":1}));
    assert_eq!(
        state["phase"], "live",
        "target absence does not invent relay failure"
    );
}

#[test]
fn live_list_updates_survive_eose_and_hide_releases_the_watch_and_target_wants() {
    let mut f = fixture::pending();
    fixture::resolve(&mut f);
    let update = event(1, 10001, 60, "", vec![]);
    relay_event(&mut f.engine, RELAY, &f.list_request, &update, NOW + 900);
    f.engine.tick(NOW + 1000);
    let out = output(&mut f.session, &mut f.engine);
    assert_eq!(
        f.engine
            .store
            .replaceable(&f.owner, 10001)
            .expect("updated list")
            .id,
        update.id
    );
    assert!(
        out.iter()
            .any(|msg| msg["t"] == "rows" && msg["rows"] == json!([]))
    );
    frames(&mut f.engine);
    accept(
        &mut f.session,
        &mut f.engine,
        json!({
            "t":"hint","hint":{"visibleSubs":[],"pageHidden":false}
        }),
        NOW + 1100,
    );
    let released = frames(&mut f.engine);
    assert!(
        released
            .iter()
            .any(|frame| *frame == json!(["CLOSE", f.list_request[1]]))
    );
    f.engine.tick(NOW + 2000);
    assert!(!frames(&mut f.engine).iter().any(|frame| frame[0] == "REQ"));
    accept(
        &mut f.session,
        &mut f.engine,
        json!({"t":"close","sub":"pins"}),
        NOW + 2001,
    );
}

#[test]
fn closing_a_view_does_not_cancel_the_lookup_owned_by_an_accepted_pin_action() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    let note = event(1, 1, 10, "own", vec![]);
    engine.store.insert(note.clone(), None);
    let mut session = Session::default();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"pins","query":{"source":"pins","pubkey":note.pubkey}
        }),
        NOW,
    );
    output(&mut session, &mut engine);
    let pending = request(&mut engine, "pin", &note.pubkey, &note.id, true);
    assert!(!pending.iter().any(|out| matches!(out, Output::Sign { .. })));
    engine.network.connected(RELAY, NOW + 1);
    engine.tick(NOW + 100);
    let sent = frames(&mut engine);
    let lookup = filter_for(&sent, 10001).clone();
    accept(
        &mut session,
        &mut engine,
        json!({"t":"close","sub":"pins"}),
        NOW + 101,
    );
    assert!(
        !frames(&mut engine)
            .iter()
            .any(|frame| *frame == json!(["CLOSE", lookup[1]]))
    );
    eose(&mut engine, RELAY, &lookup, NOW + 102);
    engine.tick(NOW + 200);
    let draft = unsigned(engine.drain());
    assert_eq!(draft.kind, 10001);
    assert_eq!(draft.tags, vec![pin_tag(&note.id)]);
}

#[test]
fn an_unanswered_owner_list_never_becomes_an_empty_overwrite() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    let note = event(1, 1, 10, "own", vec![]);
    engine.store.insert(note.clone(), None);
    let pending = request(&mut engine, "pin", &note.pubkey, &note.id, true);
    assert!(!pending.iter().any(|out| matches!(out, Output::Sign { .. })));
    engine.network.connected(RELAY, NOW + 1);
    engine.tick(NOW + 100);
    let sent = frames(&mut engine);
    assert_eq!(filter_for(&sent, 10001)[2]["authors"], json!([note.pubkey]));
    engine.tick(NOW + 19_000);
    assert!(
        !engine
            .drain()
            .iter()
            .any(|out| matches!(out, Output::Sign { .. }))
    );
    engine.tick(NOW + 20_001);
    error(engine.drain(), "list-not-loaded");
    assert!(engine.store.replaceable(&note.pubkey, 10001).is_none());
    assert!(!frames(&mut engine).iter().any(|frame| frame[0] == "EVENT"));
}

#[test]
fn a_refused_target_lookup_reports_unavailable_after_the_list_became_live() {
    let mut f = fixture::pending();
    f.engine.network.message(
        RELAY,
        &json!([
            "CLOSED",
            f.note_request[1],
            "blocked: deterministic refusal"
        ])
        .to_string(),
        NOW + 600,
    );
    f.engine.tick(NOW + 700);
    let out = output(&mut f.session, &mut f.engine);
    assert_eq!(
        fixture::state(&out)["pins"],
        json!({"pending":0,"unavailable":1})
    );
}

#[test]
fn deletion_marks_the_pin_unavailable_without_refetching_the_deleted_target() {
    let mut f = fixture::pending();
    fixture::resolve(&mut f);
    frames(&mut f.engine);
    f.engine
        .enqueue(RELAY.into(), event(2, 5, 80, "", vec![pin_tag(&f.note.id)]));
    f.engine.tick(NOW + 1000);
    let out = output(&mut f.session, &mut f.engine);
    assert_eq!(
        fixture::state(&out)["pins"],
        json!({"pending":0,"unavailable":1})
    );
    f.engine.tick(NOW + 1100);
    assert!(!frames(&mut f.engine).iter().any(|frame| {
        frame[0] == "REQ"
            && frame[2]["ids"]
                .as_array()
                .is_some_and(|ids| ids.iter().any(|id| id == &f.note.id))
    }));
}
