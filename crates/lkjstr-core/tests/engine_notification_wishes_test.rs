#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, protocol, wire::Session};
use serde_json::json;

#[test]
fn notification_read_mark_remembers_timestamp_ties_across_reload() {
    let me = "aa".repeat(32);
    let mut e = Engine::new();
    let mut reaction = event(5, 7, "+", vec![vec!["p".into(), me.clone()]]);
    reaction.pubkey = "bb".repeat(32);
    e.store.insert(reaction, None);
    let (at, ties) = lkjstr_core::engine::wire::notification_watermark(&e, &me);
    e.seen.insert(me.clone(), at);
    e.notification_ties.insert(me.clone(), ties);
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 0);
    let mut later = event(
        5,
        7,
        "+",
        vec![
            vec!["p".into(), me.clone()],
            vec!["e".into(), "cc".repeat(32)],
        ],
    );
    later.pubkey = "dd".repeat(32);
    e.store.insert(later, None);
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 1);
    let accounts = lkjstr_core::engine::accounts::Accounts {
        seen: e.seen.clone(),
        notification_ties: e.notification_ties.clone(),
        ..Default::default()
    };
    let restored: lkjstr_core::engine::accounts::Accounts =
        serde_json::from_str(&serde_json::to_string(&accounts).expect("save")).expect("reload");
    e.seen = restored.seen;
    e.notification_ties = restored.notification_ties;
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 1);
}

#[test]
fn cached_contact_lists_never_become_notifications_or_unread_counts() {
    let me = "aa".repeat(32);
    let signer = lkjstr_protocol::generate_secret_key();
    let contact_at = |created_at| {
        lkjstr_protocol::finalize_event(
            &lkjstr_protocol::EventTemplate {
                pubkey: None,
                created_at,
                kind: 3,
                content: String::new(),
                tags: vec![vec!["p".into(), me.clone()]],
            },
            &signer,
        )
        .expect("contact list")
    };
    let contact = contact_at(100);
    let mut e = Engine::new();
    // Reproduce Worker cache boot: compact decoding, verification and indexing.
    let raw = lkjstr_protocol::compact::encode(&contact).expect("cached contact list");
    e.enqueue(
        "cache".into(),
        lkjstr_protocol::compact::decode(&raw).expect("reload"),
    );
    e.tick(0);
    assert_eq!(e.store.follows(&contact.pubkey), Some(vec![me.clone()]));
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 0);
    assert_eq!(
        lkjstr_core::engine::wire::notification_watermark(&e, &me),
        Default::default()
    );
    let mut s = Session::default();
    for source in ["notifications", "global", "home"] {
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":source,"query":{
                "source":source,"account":me,"notifications":true
            }}),
            1,
        );
        let rows = output(&mut s, &mut e);
        assert!(rows.iter().any(|m| m["t"] == "rows" && m["sub"] == source));
        assert!(
            rows.iter()
                .filter(|m| m["t"] == "rows")
                .all(|m| m["rows"] == json!([]))
        );
    }
    // A newer whole-list replacement must also stay out of live notifications.
    e.enqueue(RELAY.into(), contact_at(200));
    e.tick(2);
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 0);
    assert!(
        output(&mut s, &mut e)
            .iter()
            .all(|m| { m["t"] != "fresh" || m["count"] == 0 })
    );
}

#[test]
fn notification_requests_preserve_kinds_but_untrusted_zaps_do_not_supply_unread() {
    let me = "aa".repeat(32);
    let mut e = Engine::new();
    let mut parent = event(1, 1, "my post", vec![]);
    parent.pubkey = me.clone();
    e.store.insert(parent.clone(), None);
    for (at, kind, target) in [
        (2, 1, false),
        (3, 1, true),
        (4, 6, true),
        (5, 7, true),
        (6, 9735, true),
    ] {
        let mut tags = vec![vec!["p".into(), me.clone()]];
        if target {
            tags.push(vec![
                "e".into(),
                parent.id.clone(),
                "".into(),
                "reply".into(),
            ]);
        }
        e.store.insert(event(at, kind, "+", tags), None);
    }
    e.store
        .insert(event(7, 3, "", vec![vec!["p".into(), me.clone()]]), None);
    let q = protocol::Query {
        source: protocol::Source::Notifications,
        account: Some(me.clone()),
        ..Default::default()
    };
    assert_eq!(
        lkjstr_core::engine::query::filter(&e.store, &q).kinds,
        Some(vec![1, 42, 6, 16, 7, 9735])
    );
    assert_eq!(lkjstr_core::engine::wire::unread_count(&e, &me), 4);
    let (at, ties) = lkjstr_core::engine::wire::notification_watermark(&e, &me);
    assert_eq!(at, 5000);
    assert_eq!(ties.len(), 1);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"news","query":{"source":"notifications","account":me}}),
        0,
    );
    let messages = output(&mut s, &mut e);
    let rows = messages.iter().find(|m| m["t"] == "rows").expect("rows")["rows"]
        .as_array()
        .expect("notification rows");
    let mut types = rows
        .iter()
        .map(|r| r["type"].as_str().expect("type"))
        .collect::<Vec<_>>();
    types.sort();
    assert_eq!(types, ["mention", "reaction", "reply", "repost"]);
}
