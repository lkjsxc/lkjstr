#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, accept, event, output};
use lkjstr_core::engine::{Engine, channels, wire};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
fn signed(
    key: &SecretKeyBytes,
    at: u64,
    kind: u64,
    text: &str,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        key,
    )
    .expect("fixture")
}
fn root(id: &str) -> Vec<Vec<String>> {
    vec![vec!["e".into(), id.into(), RELAY.into(), "root".into()]]
}
fn rows(e: &mut Engine, q: Value) -> Vec<Value> {
    let mut s = wire::Session::default();
    accept(&mut s, e, json!({"t":"open","sub":"rows","query":q}), 1000);
    output(&mut s, e)
        .into_iter()
        .find(|m| m["t"] == "rows")
        .expect("rows")["rows"]
        .as_array()
        .expect("array")
        .clone()
}
#[test]
fn joined_order_words_references_creator_metadata_and_unread_are_projected() {
    let mut e = Engine::new();
    let key = generate_secret_key();
    let a = signed(&key, 1, 40, r#"{"name":"Alpha","about":"garden"}"#, vec![]);
    let b = signed(&key, 2, 40, r#"{"name":"Beta"}"#, vec![]);
    let c = signed(&key, 3, 40, r#"{"name":"Gamma"}"#, vec![]);
    let reader = event(
        4,
        10005,
        "",
        vec![
            vec!["e".into(), c.id.clone()],
            vec!["e".into(), a.id.clone()],
            vec!["e".into(), b.id.clone()],
        ],
    );
    for v in [&a, &b, &c, &reader] {
        e.store.insert(v.clone(), None);
    }
    let update = signed(
        &key,
        10,
        41,
        r#"{"name":"Renamed Alpha","about":"GARDEN"}"#,
        root(&a.id),
    );
    let forged = event(20, 41, r#"{"name":"Forged"}"#, root(&a.id));
    let old = signed(&key, 9, 41, r#"{"name":"Old"}"#, root(&a.id));
    for v in [update, forged, old] {
        e.store.insert(v, None);
    }
    let message = event(30, 42, "first line\nsecond", root(&a.id));
    e.store.insert(message, None);
    let list = rows(&mut e, json!({"source":"channels","account":reader.pubkey}));
    assert_eq!(
        list.iter()
            .map(|r| r["id"].as_str().expect("id"))
            .collect::<Vec<_>>(),
        vec![c.id.as_str(), a.id.as_str(), b.id.as_str()]
    );
    assert_eq!(list[1]["name"], "Renamed Alpha");
    assert_eq!(list[1]["last"]["excerpt"], "first line");
    assert_eq!(list[1]["unread"], 1);
    let filtered = rows(&mut e, json!({"source":"channels","text":"alpha GARDEN"}));
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0]["id"], a.id);
    let exact = rows(
        &mut e,
        json!({"source":"channels","text":list[1]["bech32"]}),
    );
    assert_eq!(exact.len(), 1);
    assert_eq!(exact[0]["joined"], false);
    e.seen
        .insert(format!("channel:{}:{}", reader.pubkey, a.id), 30000);
    assert_eq!(
        rows(&mut e, json!({"source":"channels","account":reader.pubkey}))[1]["unread"],
        0
    );
}
#[test]
fn channel_threads_notifications_bookmarks_filters_and_global_have_separate_domains() {
    let mut e = Engine::new();
    e.signed_out_global_filter = false;
    let key = generate_secret_key();
    let c = signed(&key, 1, 40, r#"{"name":"Room"}"#, vec![]);
    let a = signed(&key, 10, 42, "parent", root(&c.id));
    let mut tags = root(&c.id);
    tags.push(vec!["e".into(), a.id.clone(), RELAY.into(), "reply".into()]);
    tags.push(vec!["p".into(), a.pubkey.clone()]);
    let b = event(20, 42, "answer blue", tags);
    let bookmarks = signed(&key, 30, 10003, "", vec![vec!["e".into(), b.id.clone()]]);
    for v in [&c, &a, &b, &bookmarks] {
        e.store.insert(v.clone(), None);
    }
    let feed = rows(
        &mut e,
        json!({"source":"channel","id":c.id,"text":"blue","phrases":["answer blue"],"exclude":["spam"],"authors":[b.pubkey],"since":11000,"until":20000}),
    );
    assert_eq!(feed.len(), 2);
    assert_eq!(feed[0]["kind"], "channel");
    assert_eq!(feed[1]["id"], b.id);
    assert_eq!(feed[1]["channel"]["name"], "Room");
    assert_eq!(feed[1]["replyTo"]["id"], a.id);
    let all = rows(&mut e, json!({"source":"channel","id":c.id}));
    assert!(all[2].get("replyTo").is_none());
    assert!(rows(&mut e, json!({"source":"global"})).is_empty());
    e.store
        .insert(event(25, 6, "", vec![vec!["e".into(), b.id.clone()]]), None);
    assert!(rows(&mut e, json!({"source":"global"})).is_empty());
    let thread = rows(&mut e, json!({"source":"thread","id":b.id}));
    assert_eq!(thread.len(), 2);
    assert_eq!(thread[0]["thread"]["role"], "ancestor");
    let notifications = rows(&mut e, json!({"source":"notifications","account":a.pubkey}));
    assert_eq!(notifications[0]["type"], "reply");
    assert_eq!(notifications[0]["note"]["channel"]["id"], c.id);
    assert_eq!(
        rows(&mut e, json!({"source":"bookmarks","account":a.pubkey}))[0]["channel"]["id"],
        c.id
    );
    let mute = signed(
        &key,
        40,
        10000,
        "",
        vec![vec!["p".into(), b.pubkey.clone()]],
    );
    e.store.insert(mute, None);
    let covered = rows(
        &mut e,
        json!({"source":"channel","id":c.id,"account":a.pubkey}),
    );
    assert_eq!(covered.len(), 3);
    assert_eq!(covered[1]["key"], b.id);
    assert_eq!(covered[1]["hidden"]["reason"], "muted-person");
    assert_eq!(covered[1]["segments"], json!([]));
}
#[test]
fn drafts_inherit_channels_and_authored_actions_keep_nip28_tags() {
    let mut e = Engine::new();
    let key = generate_secret_key();
    let c = signed(&key, 1, 40, r#"{"name":"Room"}"#, vec![]);
    let parent = signed(&key, 2, 42, "parent", root(&c.id));
    e.store.insert(c.clone(), Some(RELAY));
    e.store.insert(parent.clone(), Some(RELAY));
    let mut s = wire::Session::default();
    for (req, what, kind) in [
        (
            "reply",
            json!({"k":"note","draft":{"text":"reply #topic","replyTo":parent.id}}),
            42,
        ),
        (
            "root",
            json!({"k":"note","draft":{"text":"root","channel":c.id}}),
            42,
        ),
        ("repost", json!({"k":"repost","id":parent.id}), 16),
        (
            "reaction",
            json!({"k":"reaction","id":parent.id,"emoji":"+"}),
            7,
        ),
    ] {
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":req,"action":{"a":"publish","as":parent.pubkey,"what":what}}),
            5000,
        );
        let out = output(&mut s, &mut e);
        let unsigned = out.iter().find(|m| m["t"] == "sign").expect("sign");
        let event: Value =
            serde_json::from_str(unsigned["event"].as_str().expect("event")).expect("json");
        assert_eq!(event["kind"], kind);
        assert!(
            event["tags"]
                .as_array()
                .expect("tags")
                .iter()
                .any(|t| t[0] == "client")
        );
        if kind == 42 {
            assert!(
                event["tags"]
                    .as_array()
                    .expect("tags")
                    .iter()
                    .any(|t| t[1] == c.id && t[3] == "root")
            );
        }
        if req == "reply" {
            assert!(
                event["tags"]
                    .as_array()
                    .expect("tags")
                    .iter()
                    .any(|t| t[1] == parent.id && t[3] == "reply")
            );
        }
    }
    assert_eq!(channels::metadata(&e.store, &c.id).0["name"], "Room");
}
#[test]
fn unknown_reference_has_an_honest_header_and_nonchannel_reference_has_none() {
    let mut e = Engine::new();
    let note = event(1, 1, "not a channel", vec![]);
    assert_eq!(
        rows(&mut e, json!({"source":"channel","id":note.id}))[0]["name"],
        ""
    );
    e.store.insert(note.clone(), None);
    assert!(rows(&mut e, json!({"source":"channels","text":note.id})).is_empty());
}
