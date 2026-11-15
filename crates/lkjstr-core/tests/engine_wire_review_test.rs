#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::{Value, json};
#[test]
fn relay_capabilities_reach_the_unsigned_event_and_disabled_entries_drop() {
    for (read, write, marker) in [
        (true, true, None),
        (true, false, Some("read")),
        (false, true, Some("write")),
        (false, false, None),
    ] {
        let mut e = Engine::new();
        let mut s = Session::default();
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":"r","action":{"a":"relays.save","as":"a".repeat(64),"relays":[{"url":RELAY,"read":read,"write":write}]}}),
            0,
        );
        let out = output(&mut s, &mut e);
        if !read && !write {
            let event: Value =
                serde_json::from_str(out[0]["event"].as_str().expect("event")).expect("unsigned");
            assert_eq!(event["tags"], json!([]));
            continue;
        }
        let event: Value =
            serde_json::from_str(out[0]["event"].as_str().expect("event")).expect("unsigned");
        let mut expected = vec![json!("r"), json!(RELAY)];
        if let Some(marker) = marker {
            expected.push(json!(marker));
        }
        assert_eq!(event["tags"], json!([expected]));
    }
}
#[test]
fn finished_note_reply_and_quote_text_derive_discoverable_tags() {
    let parent = event(1, 1, "parent", vec![]);
    for mode in ["note", "reply", "quote"] {
        let mut e = Engine::new();
        let mut s = Session::default();
        e.store.insert(parent.clone(), None);
        let npub = lkjstr_protocol::encode_npub(&parent.pubkey).expect("npub");
        let mut draft = json!({"text":format!("hello #Nostr #nostr nostr:{npub}"),"cw":"cw"});
        if mode == "reply" {
            draft["replyTo"] = json!(parent.id);
        }
        if mode == "quote" {
            draft["quote"] = json!(parent.id);
        }
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":"p","action":{"a":"publish","as":"a".repeat(64),"what":{"k":"note","draft":draft}}}),
            0,
        );
        let out = output(&mut s, &mut e);
        let event: Value =
            serde_json::from_str(out[0]["event"].as_str().expect("event")).expect("unsigned");
        let tags = event["tags"].as_array().expect("tags");
        assert_eq!(
            tags.iter().filter(|t| **t == json!(["t", "nostr"])).count(),
            1
        );
        assert_eq!(
            tags.iter()
                .filter(|t| t[0] == "p" && t[1] == parent.pubkey)
                .count(),
            1
        );
        assert!(tags.contains(&json!(["content-warning", "cw"])));
        if mode == "reply" {
            assert!(tags.iter().any(|t| t[0] == "e" && t[1] == parent.id));
        }
        if mode == "quote" {
            assert!(tags.iter().any(|t| t[0] == "q" && t[1] == parent.id));
        }
    }
}
#[test]
fn mute_updates_remove_previously_delivered_rows_and_unmute_restores_them() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let note = event(1, 1, "visible", vec![]);
    e.store.insert(note.clone(), None);
    let mut mute = event(2, 10000, "", vec![vec!["p".into(), note.pubkey.clone()]]);
    let account = mute.pubkey.clone();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global","account":account}}),
        0,
    );
    let out = output(&mut s, &mut e);
    assert_eq!(out[0]["rows"][0]["key"], note.id);
    e.enqueue("cache".into(), mute.clone());
    e.tick(75);
    let out = output(&mut s, &mut e);
    assert!(out.iter().any(|o| {
        o["t"] == "patch"
            && o["ops"]
                .as_array()
                .expect("ops")
                .iter()
                .any(|op| op["op"] == "remove" && op["key"] == note.id)
    }));
    // A newer cache entry exercises the same replacement path without printing keys.
    mute.id = "f".repeat(64);
    mute.created_at = 3;
    mute.tags.clear();
    e.store.insert(mute, None);
    let trigger = event(4, 0, "{}", vec![]);
    e.enqueue("cache".into(), trigger);
    e.tick(150);
    let out = output(&mut s, &mut e);
    assert!(out.iter().any(|o| {
        o["t"] == "patch"
            && o["ops"]
                .as_array()
                .expect("ops")
                .iter()
                .any(|op| op["op"] == "insert" && op["rows"][0]["key"] == note.id)
    }));
}
#[test]
fn note_free_profiles_update_when_metadata_arrives() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let profile = event(
        1,
        0,
        r#"{"name":"arrived","about":"new biography"}"#,
        vec![],
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"p","query":{"source":"profile","pubkey":profile.pubkey}}),
        0,
    );
    output(&mut s, &mut e);
    e.enqueue("cache".into(), profile);
    e.tick(75);
    let out = output(&mut s, &mut e);
    assert!(out.iter().any(|o| {
        o["t"] == "patch"
            && o["ops"].as_array().expect("ops").iter().any(|op| {
                op["row"]["author"]["name"] == "arrived"
                    && op["row"]["about"][0]["text"] == "new biography"
            })
    }));
}
#[test]
fn close_releases_specialized_window_and_reopening_uses_defaults() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let profile = event(1, 0, "{}", vec![]);
    let key = profile.pubkey.clone();
    e.store.insert(profile, None);
    for i in 0..20 {
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":format!("p{i}"),"query":{"source":"profile","pubkey":key}}),
            0,
        );
        accept(
            &mut s,
            &mut e,
            json!({"t":"window","sub":format!("p{i}"),"anchor":{"key":"missing"},"before":0,"after":0}),
            1,
        );
        accept(
            &mut s,
            &mut e,
            json!({"t":"close","sub":format!("p{i}")}),
            2,
        );
    }
    output(&mut s, &mut e);
    for i in 0..20 {
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":format!("p{i}"),"query":{"source":"profile","pubkey":key}}),
            3,
        );
        let out = output(&mut s, &mut e);
        assert!(
            out.iter()
                .any(|o| o["t"] == "rows" && o["rows"][0]["kind"] == "profile")
        );
    }
}
