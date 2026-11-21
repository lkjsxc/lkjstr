#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query, Source},
    wire::Session,
};
use serde_json::json;
#[test]
fn search_mutes_keep_bounded_slots_and_history_remains_reachable() {
    let mut e = Engine::new();
    let visible = event(1, 1, "visible", vec![]);
    e.store.insert(visible.clone(), None);
    for at in 2..82 {
        e.store.insert(event(at, 1, "blocked", vec![]), None);
    }
    let mute = event(100, 10000, "", vec![vec!["word".into(), "blocked".into()]]);
    let owner = mute.pubkey.clone();
    e.store.insert(mute, None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"search","text":"","account":owner}}),
        0,
    );
    let out = output(&mut s, &mut e);
    let rows = out.iter().find(|o| o["t"] == "rows").expect("rows")["rows"]
        .as_array()
        .expect("rows");
    assert_eq!(rows.len(), 51);
    assert!(
        rows.iter()
            .all(|row| row["hidden"]["reason"] == "muted-word")
    );
    let anchor = rows.last().expect("covered tail")["key"].clone();
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":anchor},"before":0,"after":50}),
        0,
    );
    let out = output(&mut s, &mut e);
    let rows = out.iter().find(|o| o["t"] == "rows").expect("older rows");
    assert_eq!(
        rows["rows"]
            .as_array()
            .and_then(|rows| rows.last())
            .expect("visible tail")["id"],
        visible.id
    );
}
#[test]
fn decrypted_people_set_hydrates_its_member_window() {
    let mut e = Engine::new();
    let keys: Vec<_> = (1..151).map(|i| format!("{i:064x}")).collect();
    let list = event(1, 30000, "encrypted", vec![]);
    let owner = list.pubkey.clone();
    e.private_lists.insert(
        list.id.clone(),
        keys.iter().map(|p| vec!["p".into(), p.clone()]).collect(),
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
        json!({"t":"open","sub":"feed","query":{"source":"list","account":owner}}),
        0,
    );
    output(&mut s, &mut e);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":keys[50]},"before":0,"after":20}),
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
                .filter_map(|p| p.as_str())
        })
        .collect();
    assert!(keys[50..70].iter().all(|p| authors.contains(p.as_str())));
    assert!(!authors.contains(keys[120].as_str()));
}
#[test]
fn thread_event_window_excludes_unrelated_sibling_branches() {
    let mut e = Engine::new();
    let root = event(1, 1, "root", vec![]);
    e.store.insert(root.clone(), None);
    for at in 2..102 {
        e.store.insert(
            event(at, 1, "sibling", vec![vec!["e".into(), root.id.clone()]]),
            None,
        );
    }
    let focus = event(102, 1, "focus", vec![vec!["e".into(), root.id.clone()]]);
    e.store.insert(focus.clone(), None);
    let reply = event(103, 1, "reply", vec![vec!["e".into(), focus.id.clone()]]);
    e.store.insert(reply, None);
    let rows = lkjstr_core::engine::query::events(
        &e.store,
        &Query {
            source: Source::Thread,
            target: Some(focus.id),
            ..Default::default()
        },
    );
    assert_eq!(rows.len(), 3);
}
#[test]
fn a_full_hidden_search_page_keeps_history_available_from_a_covered_anchor() {
    let mut e = Engine::new();
    let mute = event(1, 10000, "", vec![vec!["word".into(), "blocked".into()]]);
    let owner = mute.pubkey.clone();
    e.store.insert(mute, None);
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    e.network
        .relay_information(RELAY, r#"{"limitation":{"max_limit":60}}"#);
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query {
                source: Source::Search,
                account: Some(owner),
                ..Default::default()
            },
        },
        0,
    );
    e.network.connected(RELAY, 1);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([1, 6]) && f[2]["#e"].is_null())
        .expect("head");
    let mut anchor = None;
    for at in 100..160 {
        let note = event(at, 1, "blocked", vec![]);
        if at == 109 {
            anchor = Some(note.id.clone());
        }
        let note = e
            .network
            .message(RELAY, &json!(["EVENT", req[1], note]).to_string(), 2)
            .expect("event");
        e.network.event(RELAY, &note, 2);
        e.store.insert(note, Some(RELAY));
    }
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3);
    let mut sent = Vec::new();
    for now in [4, 100, 200, 300] {
        e.tick(now);
        sent.extend(frames(&mut e));
    }
    e.input(
        Input::Window {
            sub: "feed".into(),
            anchor,
            before: 0,
            after: 50,
        },
        401,
    );
    for now in [402, 500, 600] {
        e.tick(now);
        sent.extend(frames(&mut e));
    }
    assert!(sent.iter().any(|f| f[0] == "REQ" && f[2]["until"] == 100));
}
