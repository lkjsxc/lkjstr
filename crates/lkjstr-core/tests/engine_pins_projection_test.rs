#![allow(clippy::expect_used)]
#[path = "engine_pins/support.rs"]
mod support;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::json;
use support::*;

#[test]
fn two_relay_arrival_orders_keep_the_newest_replaceable_list() {
    let a = event(1, 10001, 10, "old", vec![pin_tag(&"a1".repeat(32))]);
    let b = event(1, 10001, 20, "new", vec![pin_tag(&"b2".repeat(32))]);
    for order in [[a.clone(), b.clone()], [b.clone(), a.clone()]] {
        let mut engine = Engine::new();
        for (relay, list) in [RELAY, OTHER].into_iter().zip(order) {
            engine.enqueue(relay.into(), list);
            engine.tick(NOW);
            engine.drain();
        }
        let current = engine
            .store
            .replaceable(&a.pubkey, 10001)
            .expect("current list");
        assert_eq!(current.id, b.id);
        assert_eq!(current.tags, b.tags);
    }
}

#[test]
fn equal_timestamp_pin_lists_keep_the_lowest_id_in_either_arrival_order() {
    let a = event(1, 10001, 10, "tie a", vec![]);
    let b = event(1, 10001, 10, "tie b", vec![]);
    let winner = a.id.clone().min(b.id.clone());
    for order in [[a.clone(), b.clone()], [b.clone(), a.clone()]] {
        let mut engine = Engine::new();
        for (relay, list) in [RELAY, OTHER].into_iter().zip(order) {
            engine.store.insert(list, Some(relay));
        }
        assert_eq!(
            engine
                .store
                .replaceable(&a.pubkey, 10001)
                .expect("tie winner")
                .id,
            winner
        );
    }
}

#[test]
fn public_other_user_pins_keep_tag_order_without_reordering_profile_chronology() {
    let mut engine = Engine::new();
    let old = event(1, 1, 1, "old own note", vec![]);
    let recent = event(1, 1, 30, "new own note", vec![]);
    let external = event(2, 1, 10, "another author", vec![]);
    let private = event(3, 1, 25, "must not enter public pins", vec![]);
    let list = event(
        1,
        10001,
        40,
        "opaque content",
        vec![
            pin_tag(&old.id),
            vec!["x".into(), "ignored".into()],
            vec!["e".into(), "invalid".into()],
            pin_tag(&external.id),
            pin_tag(&old.id),
            pin_tag(&recent.id),
        ],
    );
    for item in [&old, &recent, &external, &private, &list] {
        engine.store.insert(item.clone(), None);
    }
    engine
        .private_lists
        .insert(list.id.clone(), vec![pin_tag(&private.id)]);
    let mut session = Session::default();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"pins","query":{"source":"pins","pubkey":old.pubkey}
        }),
        NOW,
    );
    let pins = rows(&mut session, &mut engine, "pins");
    assert_eq!(
        ids(&pins),
        [old.id.as_str(), external.id.as_str(), recent.id.as_str()]
    );
    assert!(
        pins["rows"]
            .as_array()
            .expect("pins")
            .iter()
            .all(|r| r["pinned"] == true)
    );
    assert_eq!(pins["rows"][1]["author"]["pubkey"], external.pubkey);
    assert_eq!(pins["rows"][0]["mine"]["own"], false);
    for show in ["posts", "all"] {
        accept(
            &mut session,
            &mut engine,
            json!({
                "t":"open","sub":show,"query":{"source":"profile","pubkey":old.pubkey,"show":show}
            }),
            NOW,
        );
        let profile = rows(&mut session, &mut engine, show);
        let ordinary: Vec<_> = profile["rows"]
            .as_array()
            .expect("profile")
            .iter()
            .filter(|row| row["kind"] == "note" && row.get("eventKind").is_none())
            .map(|row| row["id"].as_str().expect("id"))
            .collect();
        assert_eq!(ordinary, [recent.id.as_str(), old.id.as_str()]);
        assert!(
            profile["rows"]
                .as_array()
                .expect("profile")
                .iter()
                .all(|r| r.get("pinned").is_none())
        );
    }
}

#[test]
fn pin_windows_use_list_positions_and_own_pin_marks_follow_the_latest_list() {
    let mut engine = Engine::new();
    let notes = [
        event(1, 1, 30, "first in time", vec![]),
        event(1, 1, 20, "second in time", vec![]),
        event(1, 1, 10, "third in time", vec![]),
    ];
    for note in &notes {
        engine.store.insert(note.clone(), None);
    }
    engine.store.insert(
        event(
            1,
            10001,
            40,
            "",
            vec![
                pin_tag(&notes[2].id),
                pin_tag(&notes[0].id),
                pin_tag(&notes[1].id),
            ],
        ),
        None,
    );
    let mut session = Session::default();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"pins","query":{"source":"pins","pubkey":notes[0].pubkey,"account":notes[0].pubkey}
        }),
        NOW,
    );
    let initial = rows(&mut session, &mut engine, "pins");
    assert_eq!(
        ids(&initial),
        [
            notes[2].id.as_str(),
            notes[0].id.as_str(),
            notes[1].id.as_str()
        ]
    );
    assert_eq!(initial["rows"][0]["mine"]["pinned"], true);
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"window","sub":"pins","anchor":{"key":notes[0].id},"before":0,"after":1
        }),
        NOW + 1,
    );
    let middle = rows(&mut session, &mut engine, "pins");
    assert_eq!(ids(&middle), [notes[0].id.as_str()]);
    assert_eq!(middle["atTop"], false);
    assert_eq!(middle["atBottom"], false);
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"own","query":{"source":"profile","pubkey":notes[0].pubkey,"account":notes[0].pubkey}
        }),
        NOW + 2,
    );
    let own = rows(&mut session, &mut engine, "own");
    assert_eq!(own["rows"][1]["mine"]["pinned"], true);
    engine.enqueue(OTHER.into(), event(1, 10001, 50, "", vec![]));
    engine.tick(NOW + 500);
    let out = output(&mut session, &mut engine);
    assert!(
        out.iter().any(|msg| {
            msg["sub"] == "own"
                && (msg["rows"].as_array().is_some_and(|rs| {
                    rs.iter()
                        .any(|r| r["id"] == notes[0].id && r["mine"]["pinned"] == false)
                }) || msg["ops"].as_array().is_some_and(|ops| {
                    ops.iter().any(|op| {
                        op["row"]["id"] == notes[0].id && op["row"]["mine"]["pinned"] == false
                    })
                }))
        }),
        "ordinary rows must invalidate their own pin action state"
    );
}

#[test]
fn public_pins_respect_the_readers_mute_cover() {
    let mut engine = Engine::new();
    let pinned = event(1, 1, 10, "hidden words", vec![]);
    let list = event(2, 10001, 20, "", vec![pin_tag(&pinned.id)]);
    let mute = event(
        3,
        10000,
        30,
        "",
        vec![vec!["p".into(), pinned.pubkey.clone()]],
    );
    for item in [&pinned, &list, &mute] {
        engine.store.insert(item.clone(), None);
    }
    let mut session = Session::default();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t":"open","sub":"pins","query":{"source":"pins","pubkey":list.pubkey,"account":mute.pubkey}
        }),
        NOW,
    );
    let out = rows(&mut session, &mut engine, "pins");
    assert_eq!(out["rows"][0]["hidden"]["reason"], "muted-person");
    assert_eq!(out["rows"][0]["segments"], json!([]));
    assert_eq!(out["rows"][0]["pinned"], true);
}
