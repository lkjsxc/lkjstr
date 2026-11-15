#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Output, Query},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
fn event(kind: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: content.into(),
            tags,
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
fn setup() -> Engine {
    let mut e = Engine::new();
    e.input(
        Input::Configure {
            relays: vec![
                "wss://a.test".into(),
                "wss://b.test".into(),
                "wss://c.test".into(),
            ],
        },
        0,
    );
    e
}
fn open(e: &mut Engine, sub: &str) {
    e.input(
        Input::Open {
            sub: sub.into(),
            query: Query::default(),
        },
        0,
    );
}
fn reqs(e: &mut Engine) -> Vec<(String, Value)> {
    e.network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(r, s) => {
                let v: Value = serde_json::from_str(&s).expect("frame");
                (v[0] == "REQ").then_some((r, v))
            }
            _ => None,
        })
        .collect()
}
#[test]
fn cached_name_is_inline_and_still_refreshes_on_the_delivering_relay() {
    let mut e = setup();
    let key = generate_secret_key();
    let sign = |kind, content: &str| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 100,
                kind,
                content: content.into(),
                tags: vec![],
            },
            &key,
        )
        .expect("fixture")
    };
    let note = sign(1, "hello");
    e.store.insert(note.clone(), Some("wss://c.test/"));
    e.store
        .insert(sign(0, r#"{"name":"known"}"#), Some("cache"));
    open(&mut e, "visible");
    assert!(e.drain().iter().any(
        |o| matches!(o, Output::Rows {items,..} if items.iter().any(|r|r.author.name=="known"))
    ));
    e.network.connected("wss://c.test/", 1);
    let frames = reqs(&mut e);
    assert!(frames.iter().any(|(r, f)| r == "wss://c.test/"
        && f[2]["kinds"] == json!([0])
        && f[2]["authors"] == json!([note.pubkey])));
    e.input(
        Input::Close {
            sub: "visible".into(),
        },
        2,
    );
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f,Effect::Disconnect(r) if r=="wss://c.test/"))
    );
}
#[test]
fn nested_quotes_reply_headers_and_repost_actors_share_one_author_batch() {
    let mut e = setup();
    let quoted = event(1, "quoted", vec![]);
    let parent = event(1, "parent", vec![]);
    let root = event(
        1,
        "visible",
        vec![
            vec!["q".into(), quoted.id.clone()],
            vec!["e".into(), parent.id.clone(), "".into(), "reply".into()],
        ],
    );
    let wrapper = event(6, "", vec![vec!["e".into(), root.id.clone()]]);
    let expected: std::collections::BTreeSet<_> = [&quoted, &parent, &root, &wrapper]
        .iter()
        .map(|e| e.pubkey.clone())
        .collect();
    for event in [quoted, parent, root, wrapper] {
        e.store.insert(event, Some("wss://c.test/"));
    }
    open(&mut e, "one");
    open(&mut e, "two");
    e.network.connected("wss://c.test/", 1);
    let frames = reqs(&mut e);
    let profiles: Vec<_> = frames
        .iter()
        .filter(|(_, f)| f[2]["kinds"] == json!([0]))
        .collect();
    assert_eq!(profiles.len(), 1);
    let actual = profiles[0].1[2]["authors"]
        .as_array()
        .expect("authors")
        .iter()
        .filter_map(Value::as_str)
        .map(str::to_owned)
        .collect();
    assert_eq!(expected, actual);
}
#[test]
fn profile_preempts_a_full_relay_then_the_feed_resumes() {
    let mut e = setup();
    open(&mut e, "feed");
    e.network
        .relays
        .get_mut("wss://a.test/")
        .expect("relay")
        .max_reqs = 1;
    e.network.connected("wss://a.test/", 1);
    let feed = reqs(&mut e);
    assert_eq!(feed.len(), 1);
    e.network.message(
        "wss://a.test/",
        &json!(["EOSE", feed[0].1[1]]).to_string(),
        2,
    );
    let note = event(1, "arrives", vec![]);
    e.enqueue("wss://a.test/".into(), note.clone());
    e.tick(100);
    let frames = reqs(&mut e);
    let lookup = &frames
        .iter()
        .find(|(_, f)| f[2]["kinds"] == json!([0]))
        .expect("priority lookup")
        .1;
    e.network.message(
        "wss://a.test/",
        &json!(["EOSE", lookup[1]]).to_string(),
        350,
    );
    e.tick(350);
    assert!(
        reqs(&mut e)
            .iter()
            .any(|(_, f)| f[2]["kinds"] == json!([1, 6]) && f[2]["since"] == 98)
    );
    // Absence on the delivering relay now allows fallback, without removing it.
    e.network.connected("wss://b.test/", 351);
    assert!(
        reqs(&mut e)
            .iter()
            .any(|(r, f)| r == "wss://b.test/" && f[2]["authors"] == json!([note.pubkey]))
    );
}

#[test]
fn arriving_authors_do_not_cancel_a_delayed_batch() {
    let mut e = setup();
    open(&mut e, "feed");
    e.network.connected("wss://a.test/", 1);
    reqs(&mut e);
    e.enqueue("wss://a.test/".into(), event(1, "first", vec![]));
    e.tick(100);
    let first = reqs(&mut e)
        .into_iter()
        .find(|(_, f)| f[2]["kinds"] == json!([0]))
        .expect("lookup");
    e.enqueue("wss://a.test/".into(), event(1, "second", vec![]));
    e.tick(200);
    let effects = e.network.drain_effects();
    assert!(!effects.iter().any(
        |f| matches!(f,Effect::Send(_,text) if text == &json!(["CLOSE",first.1[1]]).to_string())
    ));
    e.network.message(
        "wss://a.test/",
        &json!(["EOSE", first.1[1]]).to_string(),
        340,
    );
    e.tick(350);
    e.input(
        Input::Hint {
            visible_subs: vec![],
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        400,
    );
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f, Effect::Disconnect(_)))
    );
}
