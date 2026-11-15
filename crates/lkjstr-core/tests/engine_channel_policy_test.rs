#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, accept, event, output};
use lkjstr_core::engine::{Engine, network::Effect, protocol, wire};
use lkjstr_protocol::{EventPointer, encode_nevent};
use serde_json::{Value, json};
#[test]
fn nevent_hints_supplement_read_routes_and_release_with_the_view() {
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let id = "a".repeat(64);
    let hint = "wss://hint.test/";
    e.input(
        protocol::Input::Configure {
            relays: vec![
                RELAY.into(),
                "wss://read-two.test/".into(),
                "wss://read-three.test/".into(),
            ],
        },
        0,
    );
    let reference = encode_nevent(&EventPointer {
        id: id.clone(),
        relays: Some(vec![hint.into()]),
        author: None,
        kind: Some(40),
    })
    .expect("reference");
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"hint","query":{"source":"channel","ref":reference}}),
        0,
    );
    assert!(e.network.relays.contains_key(RELAY));
    assert!(e.network.relays.contains_key(hint));
    assert!(!e.network.known[hint].read);
    assert!(!e.network.known[hint].write);
    let out = output(&mut s, &mut e);
    let header = &out.iter().find(|m| m["t"] == "rows").expect("window")["rows"][0];
    let pointer = lkjstr_protocol::decode_nip19(header["bech32"].as_str().expect("reference"))
        .expect("pointer");
    assert!(
        matches!(pointer,lkjstr_protocol::NostrEntity::Nevent(p) if p.relays.as_ref().is_some_and(|r|r.contains(&hint.to_string())))
    );
    for relay in [
        RELAY,
        "wss://read-two.test/",
        "wss://read-three.test/",
        hint,
    ] {
        e.network.connected(relay, 1);
    }
    let requests = e.network.drain_effects();
    for url in [
        RELAY,
        "wss://read-two.test/",
        "wss://read-three.test/",
        hint,
    ] {
        assert!(
            requests
                .iter()
                .any(|f| matches!(f,Effect::Send(u,s) if u==url&&s.contains("REQ")))
        );
    }
    accept(&mut s, &mut e, json!({"t":"close","sub":"hint"}), 2);
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f,Effect::Disconnect(url) if url==hint))
    );
}
#[test]
fn channel_drafts_keep_media_warning_emoji_quote_and_disabled_client_tag_policy() {
    let mut e = Engine::new();
    e.client_tag = false;
    let mut s = wire::Session::default();
    let channel = event(1, 40, "{}", vec![]);
    let quote = event(2, 1, "quoted", vec![]);
    e.store.insert(channel.clone(), None);
    e.store.insert(quote.clone(), None);
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"draft","action":{"a":"publish","as":channel.pubkey,"what":{"k":"note","draft":{"text":"hi :cat: #channel","channel":channel.id,"quote":quote.id,"cw":"warning","emoji":[{"code":"cat","url":"https://example.test/cat.png"}],"media":[{"url":"https://example.test/photo.png","type":"image","mime":"image/png","w":100,"h":100}]}}}}),
        3000,
    );
    let out = output(&mut s, &mut e);
    let signed = out.iter().find(|m| m["t"] == "sign").expect("sign");
    let unsigned: Value =
        serde_json::from_str(signed["event"].as_str().expect("event")).expect("json");
    assert_eq!(unsigned["kind"], 42);
    let tags = unsigned["tags"].as_array().expect("tags");
    for name in ["e", "q", "p", "t", "emoji", "imeta", "content-warning"] {
        assert!(tags.iter().any(|t| t[0] == name), "{name}");
    }
    assert!(!tags.iter().any(|t| t[0] == "client"));
    assert!(
        unsigned["content"]
            .as_str()
            .expect("text")
            .contains("nostr:note1")
    );
}
#[test]
fn device_channel_marks_persist_and_are_cleared_when_the_account_is_removed() {
    let mut accounts = lkjstr_core::engine::accounts::Accounts::default();
    let owner = event(1, 1, "", vec![]).pubkey;
    accounts.add("extension", Some(&owner)).expect("account");
    let channel_mark = format!("channel:{owner}:{}", "b".repeat(64));
    accounts.seen.insert(channel_mark.clone(), 1000);
    let mut restored: lkjstr_core::engine::accounts::Accounts =
        serde_json::from_str(&serde_json::to_string(&accounts).expect("persist")).expect("restore");
    assert_eq!(restored.seen.get(&channel_mark), Some(&1000));
    restored.remove(&owner).expect("remove");
    assert!(!restored.seen.contains_key(&channel_mark));
}
#[test]
fn other_channels_cannot_displace_an_older_cached_channel_message() {
    let mut e = Engine::new();
    let target = event(1, 40, "{}", vec![]);
    let wanted = event(
        2,
        42,
        "older target",
        vec![vec![
            "e".into(),
            target.id.clone(),
            "".into(),
            "root".into(),
        ]],
    );
    let other = event(
        10,
        42,
        "other channel",
        vec![vec!["e".into(), "f".repeat(64), "".into(), "root".into()]],
    );
    e.store.insert(target.clone(), None);
    e.store.insert(wanted.clone(), None);
    // Index-policy fixtures bypass ingestion; signatures are tested through the relay suite.
    for i in 0..6100 {
        let mut item = other.clone();
        item.id = format!("{i:064x}");
        item.created_at = 10 + i;
        e.store.insert(item, None);
    }
    let notes = lkjstr_core::engine::query::events(
        &e.store,
        &protocol::Query {
            source: protocol::Source::Channel,
            target: Some(target.id),
            ..Default::default()
        },
    );
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].id, wanted.id);
}
