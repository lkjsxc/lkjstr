use super::{Engine, generate_secret_key, json, sign, support, unsigned};
use lkjstr_core::engine::wire::{self, Session};
use serde_json::Value;

fn send(session: &mut Session, engine: &mut Engine, message: Value, now: u64) {
    let input = serde_json::from_value::<wire::Input>(message).expect("valid wire input");
    for input in session.input(input, engine).expect("translated wire input") {
        engine.input(input, now);
    }
}

#[test]
fn signed_edit_merges_latest_metadata_and_updates_the_open_profile_before_relay_delivery() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let key = generate_secret_key();
    let previous = support::event(
        &key,
        0,
        100,
        r#"{"name":"old","display_name":"Old display","displayName":"Old alias",
            "about":"old bio","picture":"https://media.test/old.png",
            "image":"https://media.test/legacy.png","banner":"https://media.test/banner.png",
            "nip05":"old@example.test","website":"https://old.test","lud16":"old@pay.test",
            "lud06":"legacy invoice","bot":true,"pronouns":"they/them",
            "custom":{"history":[false,null,18446744073709551617001]}}"#,
        vec![],
    );
    let account = previous.pubkey.clone();
    engine.enqueue("cache".into(), previous);
    engine.enqueue(
        "cache".into(),
        support::event(&key, 0, 99, r#"{"obsolete":true}"#, vec![]),
    );
    engine.tick(48_000);
    send(
        &mut session,
        &mut engine,
        json!({"t":"open","sub":"profile","query":{"source":"profile","pubkey":account}}),
        49_000,
    );
    assert!(
        engine
            .drain()
            .into_iter()
            .flat_map(|output| session.output(output, &engine))
            .any(|output| matches!(output, wire::Output::Rows { rows, .. }
            if rows[0]["author"]["name"] == "Old display"))
    );

    send(
        &mut session,
        &mut engine,
        json!({"t":"act","req":"save","action":{"a":"profile.save","as":account,"profile":{
            "name":"New name","about":"new bio","picture":"","banner":null,
            "website":"https://new.test","bot":false,"newExtension":true
        }}}),
        50_000,
    );
    let draft = unsigned(engine.drain());
    assert_eq!(draft.created_at, 101);
    assert!(draft.content.contains("18446744073709551617001"));
    let merged: Value = serde_json::from_str(&draft.content).expect("merged object");
    assert_eq!(
        merged,
        json!({
            "name":"New name","about":"new bio","picture":"","image":"https://media.test/legacy.png",
            "website":"https://new.test","lud06":"legacy invoice","bot":true,"pronouns":"they/them",
            "custom":{"history":[false,null,18446744073709551617001.0_f64]}
        })
    );
    let signed = sign(&key, draft);
    send(
        &mut session,
        &mut engine,
        json!({"t":"signed","req":"save","event":serde_json::to_string(&signed).expect("signed JSON")}),
        50_001,
    );
    assert_eq!(
        engine
            .store
            .replaceable(&account, 0)
            .expect("current metadata")
            .id,
        signed.id
    );
    let profile = engine.store.profile(&account).expect("indexed profile");
    assert_eq!(profile.label(), Some("New name"));
    assert!(profile.picture.is_empty());
    assert_eq!(engine.pending.batch(), vec![signed.clone()]);
    assert!(
        engine
            .drain()
            .into_iter()
            .flat_map(|output| session.output(output, &engine))
            .any(
                |output| matches!(output, wire::Output::Patch { sub, ops } if sub == "profile"
            && ops.iter().any(|op| op["op"] == "update"
                && op["row"]["author"]["name"] == "New name"
                && op["row"]["author"]["profileId"] == signed.id
                && op["row"]["author"].get("picture").is_none()
                && op["row"]["about"][0]["text"] == "new bio"
                && op["row"]["banner"] == ""
                && op["row"]["website"] == "https://new.test"))
            )
    );
}
