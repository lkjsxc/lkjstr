#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Output, Query, Source},
    query,
};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::json;
#[test]
fn anchored_hydration_follows_displayed_authors_and_references() {
    let mut e = Engine::new();
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let missing = "f".repeat(64);
    let old = event(1, 1, "older", vec![vec!["q".into(), missing.clone()]]);
    e.store.insert(old.clone(), None);
    let mut newest = old.clone();
    for at in 2..=80 {
        newest = event(at, 1, &format!("head {at}"), vec![]);
        e.store.insert(newest.clone(), None);
    }
    open(&mut e, Query::default());
    e.network.connected(RELAY, 10);
    for now in [110, 210] {
        e.tick(now);
    }
    frames(&mut e);
    window(&mut e, Some(old.id.clone()), 0, 310);
    e.tick(410);
    let sent = frames(&mut e);
    assert!(
        sent.iter()
            .any(|f| f[0] == "REQ" && f[2]["authors"] == json!([old.pubkey]))
    );
    assert!(
        sent.iter()
            .any(|f| f[0] == "REQ" && f[2]["ids"] == json!([missing]))
    );
    assert!(sent.iter().any(|f| f[0] == "CLOSE"));
    window(&mut e, None, 0, 510);
    e.tick(610);
    let sent = frames(&mut e);
    assert!(
        sent.iter()
            .any(|f| f[0] == "REQ" && f[2]["authors"] == json!([newest.pubkey]))
    );
}
#[test]
fn reply_focus_includes_cached_and_late_ancestors_and_descendants() {
    let mut e = Engine::new();
    let root = event(1, 1, "root", vec![]);
    let parent = event(
        2,
        1,
        "parent",
        vec![vec!["e".into(), root.id.clone(), "".into(), "root".into()]],
    );
    let focus = event(
        3,
        1,
        "focus",
        vec![
            vec!["e".into(), root.id.clone(), "".into(), "root".into()],
            vec!["e".into(), parent.id.clone(), "".into(), "reply".into()],
        ],
    );
    let child = event(
        4,
        1,
        "child",
        vec![vec![
            "e".into(),
            focus.id.clone(),
            "".into(),
            "reply".into(),
        ]],
    );
    let q = Query {
        source: Source::Thread,
        target: Some(focus.id.clone()),
        ..Default::default()
    };
    e.store.insert(focus.clone(), None);
    e.store.insert(child.clone(), None);
    open(&mut e, q.clone());
    e.drain();
    e.enqueue("cache".into(), root.clone());
    e.enqueue("cache".into(), parent.clone());
    e.tick(75);
    let ids: Vec<_> = query::events(&e.store, &q)
        .iter()
        .map(|e| e.id.clone())
        .collect();
    assert_eq!(ids, vec![root.id, parent.id, focus.id, child.id]);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o,Output::Patch{ops,..} if !ops.is_empty()))
    );
}
#[test]
fn fresh_clears_on_return_to_head_and_when_preceding_rows_disappear() {
    let mut e = Engine::new();
    let older = event(1, 1, "old", vec![]);
    let key = generate_secret_key();
    let newer = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 2,
            kind: 1,
            content: "new".into(),
            tags: vec![],
        },
        &key,
    )
    .expect("fixture");
    e.store.insert(older.clone(), None);
    e.store.insert(newer.clone(), None);
    open(&mut e, Query::default());
    e.drain();
    window(&mut e, Some(older.id.clone()), 0, 1);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o, Output::Fresh { count: 1, .. }))
    );
    window(&mut e, None, 0, 2);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o, Output::Fresh { count: 0, .. }))
    );
    window(&mut e, Some(older.id), 0, 3);
    e.drain();
    let deletion = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 3,
            kind: 5,
            content: String::new(),
            tags: vec![vec!["e".into(), newer.id]],
        },
        &key,
    )
    .expect("deletion");
    e.enqueue("cache".into(), deletion);
    e.tick(75);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o, Output::Fresh { count: 0, .. }))
    );
}
#[test]
fn advancing_cached_tail_fetches_until_pages_before_claiming_bottom() {
    let mut e = Engine::new();
    e.signed_out_global_filter = false;
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let key = generate_secret_key();
    let mut notes = Vec::new();
    for at in 1..=205 {
        notes.push(
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: at,
                    kind: 1,
                    content: "page".into(),
                    tags: vec![],
                },
                &key,
            )
            .expect("fixture"),
        );
    }
    open(&mut e, Query::default());
    e.network.connected(RELAY, 10);
    let head = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("head");
    for note in notes.iter().skip(5) {
        if let Some(event) =
            e.network
                .message(RELAY, &json!(["EVENT", head[1], note]).to_string(), 20)
        {
            e.enqueue(RELAY.into(), event);
        }
    }
    e.network
        .message(RELAY, &json!(["EOSE", head[1]]).to_string(), 21);
    for now in (75..=600).step_by(75) {
        e.tick(now);
    }
    e.drain();
    window(&mut e, Some(notes[5].id.clone()), 50, 700);
    assert!(e.drain().iter().any(|o| matches!(
        o,
        Output::Rows {
            at_bottom: false,
            ..
        }
    )));
    let page = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["until"] == 6)
        .expect("older page");
    assert!(page[2].get("since").is_none());
    for note in notes.iter().take(6) {
        if let Some(event) =
            e.network
                .message(RELAY, &json!(["EVENT", page[1], note]).to_string(), 710)
        {
            e.enqueue(RELAY.into(), event);
        }
    }
    e.network
        .message(RELAY, &json!(["EOSE", page[1]]).to_string(), 711);
    e.tick(800);
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o,Output::Rows{items,at_bottom:true,..} if items.len()==6))
    );
    assert_eq!(e.store.len(), 205);
}
