#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, query, wire};
use lkjstr_protocol::{
    AddressPointer, EventPointer, NostrEvent, encode_naddr, encode_nevent, matches_filter,
};
use serde_json::{Value, json};

fn rows(engine: &mut Engine, query: Value) -> Vec<Value> {
    let mut session = wire::Session::default();
    accept(
        &mut session,
        engine,
        json!({"t":"open","sub":"kind-view","query":query}),
        0,
    );
    output(&mut session, engine)
        .into_iter()
        .rev()
        .find(|message| message["t"] == "rows" && message["sub"] == "kind-view")
        .expect("projected rows")["rows"]
        .as_array()
        .expect("row array")
        .clone()
}

fn address(event: &NostrEvent, identifier: &str) -> String {
    encode_naddr(&AddressPointer {
        identifier: identifier.into(),
        pubkey: event.pubkey.clone(),
        kind: event.kind,
        relays: None,
    })
    .expect("address pointer")
}

#[test]
fn generic_event_opens_by_id_and_address_with_its_own_kind() {
    let generic = event(
        10,
        30311,
        "Live event description",
        vec![vec!["d".into(), "session".into()]],
    );
    let mut engine = Engine::new();
    engine.store.insert(generic.clone(), None);
    let reference = address(&generic, "session");
    let nevent = encode_nevent(&EventPointer {
        id: generic.id.clone(),
        kind: Some(generic.kind),
        author: Some(generic.pubkey.clone()),
        relays: None,
    })
    .expect("event pointer");
    for query in [
        json!({"source":"thread","id":generic.id}),
        json!({"source":"thread","ref":reference}),
    ] {
        let projected = rows(&mut engine, query);
        assert_eq!(projected.len(), 1);
        let row = &projected[0];
        assert_eq!(row["id"], generic.id);
        assert_eq!(row["kind"], "note");
        assert_eq!(row["eventKind"], 30311);
        assert_eq!(row["thread"], json!({"role":"focus","depth":0}));
        assert_eq!(row["segments"][0]["text"], generic.content);
    }
    for (route, pointer) in [("n", &nevent), ("a", &reference)] {
        let checked =
            serde_json::to_value(wire::Session::check_link("link".into(), route, pointer))
                .expect("link result");
        assert_eq!(checked["ok"], true);
    }
}

#[test]
fn quoted_generic_event_keeps_kind_without_changing_note_or_channel_identity() {
    let channel = event(1, 40, r#"{"name":"fixture channel"}"#, vec![]);
    let generic = event(
        2,
        30311,
        "Referenced live event",
        vec![vec!["d".into(), "quoted".into()]],
    );
    let image = "https://images.example/picture.png";
    let link = "https://news.example/story";
    let note = event(
        3,
        1,
        &format!("Photo and story: {image} {link}"),
        vec![vec!["q".into(), generic.id.clone()]],
    );
    let message = event(
        4,
        42,
        "Referenced channel message",
        vec![vec![
            "e".into(),
            channel.id.clone(),
            "".into(),
            "root".into(),
        ]],
    );
    let mut engine = Engine::new();
    engine.previews.available = true;
    engine.store.insert(channel, None);
    for target in [&generic, &note, &message] {
        engine.store.insert(target.clone(), None);
        let outer = event(
            10 + target.kind,
            1,
            "Public quote",
            vec![vec!["q".into(), target.id.clone()]],
        );
        engine.store.insert(outer.clone(), None);
        let projected = rows(&mut engine, json!({"source":"thread","id":outer.id}));
        let row = projected
            .iter()
            .find(|row| row["id"] == outer.id)
            .expect("quoting note");
        assert!(row.get("eventKind").is_none());
        let quote = row["quotes"]
            .as_array()
            .expect("quotes")
            .iter()
            .find(|quote| quote["id"] == target.id)
            .expect("referenced event");
        assert_eq!(quote["state"], "ok");
        if target.id == note.id {
            assert_eq!(quote["media"][0]["url"], image);
            assert_eq!(quote["previews"][0]["source"], link);
            assert_eq!(quote["previews"][0]["kind"], "loading");
            assert_eq!(quote["nextId"], generic.id);
            assert!(quote.get("quotes").is_none());
        } else {
            assert_eq!(quote["segments"][0]["text"], target.content);
        }
        if target.kind == 30311 {
            assert_eq!(quote["eventKind"], 30311);
        } else {
            assert!(quote.get("eventKind").is_none());
            let focus = rows(&mut engine, json!({"source":"thread","id":target.id}));
            let focus = focus
                .iter()
                .find(|row| row["id"] == target.id)
                .expect("known focus");
            assert!(focus.get("eventKind").is_none());
        }
    }
}

#[test]
fn normal_replaceable_address_filter_does_not_require_an_absent_d_tag() {
    for kind in [0, 3, 10030, 30311] {
        let identifier = if kind == 30311 { "session" } else { "" };
        let tags = if identifier.is_empty() {
            vec![]
        } else {
            vec![vec!["d".into(), identifier.into()]]
        };
        let target = event(1, kind, "Coordinate target", tags);
        let reference = address(&target, identifier);
        let input: wire::queries::Query =
            serde_json::from_value(json!({"source":"thread","ref":reference})).expect("wire query");
        let converted = input.convert().expect("openable coordinate");
        let engine = Engine::new();
        let filter = query::filter(&engine.store, &converted);
        assert_eq!(filter.authors, Some(vec![target.pubkey.clone()]));
        assert_eq!(filter.kinds, Some(vec![kind]));
        assert_eq!(filter.limit, Some(1));
        assert_eq!(filter.tags.contains_key("d"), kind == 30311);
        assert!(matches_filter(&target, &filter));
    }
}

#[test]
fn directly_opened_repost_keeps_its_own_focus_with_or_without_a_stored_target() {
    let target = event(1, 1, "Original note", vec![]);
    let repost = event(
        2,
        6,
        &serde_json::to_string(&target).expect("embedded event"),
        vec![
            vec!["e".into(), target.id.clone()],
            vec!["p".into(), target.pubkey.clone()],
        ],
    );
    assert_ne!(repost.pubkey, target.pubkey);
    for target_stored in [false, true] {
        let mut engine = Engine::new();
        if target_stored {
            engine.store.insert(target.clone(), None);
        }
        engine.store.insert(repost.clone(), None);
        let projected = rows(&mut engine, json!({"source":"thread","id":repost.id}));
        assert_eq!(
            projected.len(),
            1,
            "the repost remains available when target_stored={target_stored}"
        );
        let focus = &projected[0];
        assert_eq!(focus["id"], repost.id);
        assert_eq!(focus["key"], repost.id);
        assert_eq!(focus["author"]["pubkey"], repost.pubkey);
        assert_eq!(focus["eventKind"], 6);
        assert_eq!(focus["thread"], json!({"role":"focus","depth":0}));
    }
}

#[test]
fn covered_generic_focus_keeps_kind_identity_when_its_author_is_muted() {
    let generic = event(
        20,
        30311,
        "Muted live event body",
        vec![vec!["d".into(), "muted-session".into()]],
    );
    let mute = event(
        21,
        10000,
        "",
        vec![vec!["p".into(), generic.pubkey.clone()]],
    );
    let account = mute.pubkey.clone();
    let mut engine = Engine::new();
    engine.store.insert(generic.clone(), None);
    engine.store.insert(mute, None);
    let projected = rows(
        &mut engine,
        json!({"source":"thread","id":generic.id,"account":account}),
    );
    let focus = projected
        .iter()
        .find(|row| row["id"] == generic.id)
        .expect("covered focus");
    assert_eq!(focus["hidden"]["reason"], "muted-person");
    assert_eq!(focus["segments"], json!([]));
    assert_eq!(focus["thread"], json!({"role":"focus","depth":0}));
    assert_eq!(focus["eventKind"], 30311);
}
