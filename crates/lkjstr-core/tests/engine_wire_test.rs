#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    Engine, protocol,
    wire::{Input, Output, Session},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
fn event(kind: u64, content: String, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content,
            tags,
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
fn accept(session: &mut Session, e: &mut Engine, input: Value) {
    let parsed = serde_json::from_value::<Input>(input).expect("frontend contract input");
    for input in session.input(parsed, e).expect("supported input") {
        e.input(input, 100000);
    }
}
#[test]
fn public_drafts_and_reactions_preserve_the_selected_emoji_tag() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let target = event(1, "target".into(), vec![]);
    e.store.insert(target.clone(), None);
    let address = format!("30030:{}:cats:one two", target.pubkey);
    let url = format!("https://images.test/smile?ref=:{address}").replace(' ', "%20");
    for (req, what, expected) in [
        (
            "note",
            json!({"k":"note","draft":{"text":":Hi-cat:","emoji":[
                {"code":"Hi-cat","url":"https://images.test/old.png"},
                {"code":"Hi-cat","url":url,"address":address},
                {"code":"unused","url":"https://images.test/unused.png"}
            ]}}),
            json!([["emoji", "Hi-cat", url, address]]),
        ),
        (
            "reaction",
            json!({"k":"reaction","id":target.id,"emoji":":Hi-cat:","url":url,"address":address}),
            json!([["emoji", "Hi-cat", url, address]]),
        ),
        (
            "invalid-address",
            json!({"k":"reaction","id":target.id,"emoji":":Hi-cat:","url":url,"address":"bogus"}),
            json!([["emoji", "Hi-cat", url]]),
        ),
        (
            "non-token",
            json!({"k":"reaction","id":target.id,"emoji":":Hi-cat","url":url}),
            json!([]),
        ),
    ] {
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":req,"action":{"a":"publish","as":target.pubkey,"what":what}}),
        );
        let signed = e
            .drain()
            .into_iter()
            .flat_map(|o| s.output(o, &e))
            .find_map(|o| match o {
                Output::Sign { event, .. } => Some(event),
                _ => None,
            })
            .expect("unsigned event");
        let event: Value = serde_json::from_str(&signed).expect("event JSON");
        let tags: Vec<_> = event["tags"]
            .as_array()
            .expect("tags")
            .iter()
            .filter(|t| t[0] == "emoji")
            .collect();
        assert_eq!(json!(tags), expected, "{req}");
    }
}

#[test]
fn frontend_contract_flat_filters_millis_anchor_and_finished_rows() {
    let mut e = Engine::new();
    let note = event(
        1,
        "hello :cat: https://example.test/a.png".into(),
        vec![vec![
            "emoji".into(),
            "cat".into(),
            "https://example.test/cat.png".into(),
        ]],
    );
    e.store.insert(note.clone(), None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global","since":99000,"until":101000,"authors":[note.pubkey]}}),
    );
    let output = e
        .drain()
        .into_iter()
        .flat_map(|o| s.output(o, &e))
        .collect::<Vec<_>>();
    let rows = output
        .iter()
        .find(|output| matches!(output, Output::Rows { sub, .. } if sub == "feed"))
        .expect("feed rows");
    let value = serde_json::to_value(rows).expect("output");
    assert_eq!(value["t"], "rows");
    let row = &value["rows"][0];
    assert_eq!(row["kind"], "note");
    assert_eq!(row["key"], note.id);
    assert_eq!(row["at"], 100000);
    assert!(
        row["author"]["npub"]
            .as_str()
            .is_some_and(|s| s.starts_with("npub1"))
    );
    assert_eq!(row["media"][0]["type"], "image");
    assert!(
        row["segments"]
            .as_array()
            .expect("segments")
            .iter()
            .any(|p| p["k"] == "emoji")
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":note.id},"before":0,"after":1}),
    );
    assert!(
        e.drain()
            .into_iter()
            .flat_map(|o| s.output(o, &e))
            .any(|o| matches!(o,Output::Rows{rows,..} if rows.len()==1))
    );
}
#[test]
fn authoritative_actions_and_signer_json_are_correlated() {
    let mut e = Engine::new();
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"p","action":{"a":"publish","as":"a".repeat(64),"what":{"k":"note","draft":{"text":"hello","cw":"warning"}}}}),
    );
    let output = e
        .drain()
        .into_iter()
        .flat_map(|o| s.output(o, &e))
        .collect::<Vec<_>>();
    let Output::Sign {
        req,
        pubkey,
        event,
        action_req,
        expires_at,
        weight,
    } = &output[0]
    else {
        panic!("sign")
    };
    assert!(action_req.is_none());
    assert!(expires_at.is_some());
    assert_eq!(*weight, 16);
    assert_eq!(req, "p");
    assert_eq!(pubkey, &"a".repeat(64));
    let event: Value = serde_json::from_str(event).expect("sign event JSON");
    assert_eq!(event["content"], "hello");
    assert_eq!(event["tags"][0][0], "content-warning");
    accept(
        &mut s,
        &mut e,
        json!({"t":"signed","req":"p","error":"refused"}),
    );
    assert!(
        e.drain()
            .into_iter()
            .flat_map(|o| s.output(o, &e))
            .any(|o| matches!(o,Output::Result{ok:false,req,..} if req=="p"))
    );
}
#[test]
fn missing_lists_and_unsupported_actions_return_results() {
    let mut e = Engine::new();
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"f","action":{"a":"follow","as":"a".repeat(64),"pubkey":"b".repeat(64),"on":true}}),
    );
    assert!(e.drain().into_iter().flat_map(|o| s.output(o, &e)).any(
        |o| matches!(o,Output::Result{ok:false,error:Some(error),..} if error.code=="not-found")
    ));
    let input=serde_json::from_value(json!({"t":"act","req":"u","action":{"a":"upload","as":"a".repeat(64),"name":"x.png","mime":"image/png"}})).expect("upload shape");
    assert!(matches!(s.input(input,&e),Err((Some(req),"unsupported")) if req=="u"));
}
#[test]
fn profiles_people_and_mutes_have_frontend_row_kinds() {
    let mut e = Engine::new();
    let profile = event(
        0,
        json!({"name":"person","about":"bio"}).to_string(),
        vec![],
    );
    let key = profile.pubkey.clone();
    e.store.insert(profile, None);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"p","query":{"source":"profile","pubkey":key}}),
    );
    let out = e
        .drain()
        .into_iter()
        .flat_map(|o| s.output(o, &e))
        .collect::<Vec<_>>();
    assert!(out.iter().any(|o|matches!(o,Output::Rows{rows,..} if rows.first().is_some_and(|r|r["kind"]=="profile" && r["author"]["name"]=="person"))));
    let _ = protocol::Source::Followers;
}
