#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::{EventPointer, encode_nevent};
use serde_json::{Value, json};

fn rows(engine: &mut Engine, query: Value) -> Vec<Value> {
    let mut session = wire::Session::default();
    accept(
        &mut session,
        engine,
        json!({"t":"open","sub":"public-view","query":query}),
        0,
    );
    output(&mut session, engine)
        .into_iter()
        .rev()
        .find(|message| message["t"] == "rows" && message["sub"] == "public-view")
        .expect("public rows")["rows"]
        .as_array()
        .expect("row array")
        .clone()
}

#[test]
fn stored_private_and_ephemeral_events_never_become_public_focus_or_quote_bodies() {
    for kind in [4, 13, 14, 1059, 20000, 24133, 29999] {
        let restricted = event(1, kind, &format!("restricted-body-{kind}"), vec![]);
        let quoting = event(
            2,
            1,
            "A public note referring to a restricted event",
            vec![vec!["q".into(), restricted.id.clone()]],
        );
        let mut engine = Engine::new();
        // Private workflows can retain these records; public reads must not expose them.
        engine.store.insert(restricted.clone(), None);
        engine.store.insert(quoting.clone(), None);
        assert!(engine.store.get(&restricted.id).is_some());

        let focus = rows(&mut engine, json!({"source":"thread","id":restricted.id}));
        assert!(focus.is_empty(), "kind {kind} has no public focus");

        let projected = rows(&mut engine, json!({"source":"thread","id":quoting.id}));
        let row = projected
            .iter()
            .find(|row| row["id"] == quoting.id)
            .expect("public quoting note");
        let quote = row["quotes"]
            .as_array()
            .expect("quotes")
            .iter()
            .find(|quote| quote["id"] == restricted.id)
            .expect("reference placeholder");
        assert_ne!(quote["state"], "ok", "kind {kind} is not a public quote");
        assert!(
            !serde_json::to_string(row)
                .expect("wire row")
                .contains(&restricted.content)
        );
        assert!(engine.store.get(&restricted.id).is_some());

        let pointer = encode_nevent(&EventPointer {
            id: restricted.id,
            kind: Some(kind),
            author: Some(restricted.pubkey),
            relays: None,
        })
        .expect("event pointer");
        let checked = serde_json::to_value(wire::Session::check_link("link".into(), "n", &pointer))
            .expect("link result");
        assert_eq!(checked["ok"], false, "kind {kind} hint is not public");
    }
}

#[test]
fn a_public_reply_does_not_copy_a_restricted_parent_excerpt() {
    for kind in [4, 13, 14, 1059, 20000, 24133, 29999] {
        let parent = event(1, kind, &format!("private-parent-excerpt-{kind}"), vec![]);
        let reply = event(
            2,
            1,
            "This public note answers an event that is not publicly readable",
            vec![vec![
                "e".into(),
                parent.id.clone(),
                "".into(),
                "reply".into(),
            ]],
        );
        let mut engine = Engine::new();
        engine.store.insert(parent.clone(), None);
        engine.store.insert(reply.clone(), None);
        let projected = rows(
            &mut engine,
            json!({"source":"global","account":"a".repeat(64)}),
        );
        let row = projected
            .iter()
            .find(|row| row["id"] == reply.id)
            .expect("public reply");
        assert!(
            row.get("replyTo").is_none(),
            "kind {kind} parent is omitted"
        );
        assert!(
            !serde_json::to_string(row)
                .expect("wire row")
                .contains(&parent.content)
        );
        assert!(engine.store.get(&parent.id).is_some());
    }
}
