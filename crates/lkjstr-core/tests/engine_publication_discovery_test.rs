#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Action, Input, Output},
    wire::RelayConfig,
};
use lkjstr_protocol::{EventTemplate, finalize_event, parse_secret_key_hex};
use serde_json::{Value, json};
fn event(seed: u8, kind: u64, tags: Vec<Vec<String>>) -> lkjstr_protocol::NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind,
            tags,
            content: String::new(),
        },
        &parse_secret_key_hex(&format!("{seed:02x}").repeat(32)).expect("fixture"),
    )
    .expect("event")
}
#[test]
fn missing_inbox_is_discovered_after_first_success_and_unanswered_delivery_stays_unknown() {
    let mut e = Engine::new();
    let own = "wss://own.test/";
    // Write-only configuration still supplies a chosen lookup route.
    e.configure_relays(
        vec![RelayConfig {
            url: own.into(),
            read: false,
            write: true,
            search: false,
        }],
        0,
    )
    .expect("config");
    let receiver = event(
        2,
        10002,
        vec![vec!["r".into(), "wss://inbox.test/".into(), "read".into()]],
    );
    let author = event(1, 1, vec![]).pubkey;
    e.input(
        Input::Action {
            req: "post".into(),
            account: author,
            action: Action::Publish {
                kind: "note".into(),
                content: "hello".into(),
                target: None,
                tags: vec![vec!["p".into(), receiver.pubkey.clone()]],
            },
        },
        100000,
    );
    let unsigned = e
        .drain()
        .into_iter()
        .find_map(|o| match o {
            Output::Sign { event, .. } => Some(event),
            _ => None,
        })
        .expect("sign");
    let signed = finalize_event(
        &EventTemplate {
            pubkey: Some(unsigned.pubkey),
            created_at: unsigned.created_at,
            kind: unsigned.kind,
            tags: unsigned.tags,
            content: unsigned.content,
        },
        &parse_secret_key_hex(&"01".repeat(32)).expect("fixture"),
    )
    .expect("signed");
    let id = signed.id.clone();
    e.input(
        Input::Signed {
            req: "post".into(),
            event: Some(signed),
            error: None,
        },
        100001,
    );
    e.network.connected(own, 100002);
    let req = e
        .network
        .drain_effects()
        .into_iter()
        .find_map(|fx| match fx {
            Effect::Send(_, text) => {
                let f: Value = serde_json::from_str(&text).expect("frame");
                (f[0] == "REQ" && f[2]["kinds"] == json!([10002])).then(|| f[1].clone())
            }
            _ => None,
        })
        .expect("inbox lookup");
    e.network
        .message(own, &json!(["OK", id, true, ""]).to_string(), 100003);
    e.tick(100004);
    assert!(!e.network.pending_event(&id));
    assert!(
        e.drain()
            .iter()
            .any(|o| matches!(o, Output::Result { error: None, .. }))
    );
    assert_eq!(
        e.network.recent_publications()[0]["unresolvedRecipients"],
        1
    );
    let incoming = e
        .network
        .message(own, &json!(["EVENT", req, receiver]).to_string(), 100005)
        .expect("matching");
    e.enqueue(own.into(), incoming);
    e.tick(100006);
    assert_eq!(
        e.network.recent_publications()[0]["unresolvedRecipients"],
        0
    );
    assert!(
        e.network
            .drain_effects()
            .iter()
            .any(|f| matches!(f,Effect::Connect(u) if u=="wss://inbox.test/"))
    );
    e.network.connected("wss://inbox.test/", 100007);
    assert!(e.network.drain_effects().iter().any(
        |f| matches!(f,Effect::Send(u,t) if u=="wss://inbox.test/" && t.starts_with("[\"EVENT\""))
    ));
    e.tick(130002);
    assert_eq!(
        e.network.publication_stats()["wss://inbox.test/"].publish_failed,
        0
    );
    assert_eq!(
        e.network.publication_stats()["wss://inbox.test/"].publish_pending,
        1
    );
    assert_eq!(e.stats()["totals"]["subscriptions"], 0);
    assert!(!e.drain().iter().any(|o| matches!(o, Output::Result { .. })));
}

#[test]
fn delete_cancels_late_original_fanout() {
    let mut e = Engine::new();
    let own = "wss://own.test/";
    e.configure_relays(
        vec![RelayConfig {
            url: own.into(),
            read: true,
            write: true,
            search: false,
        }],
        0,
    )
    .expect("config");
    let receiver = event(2, 1, vec![]).pubkey;
    let original = event(1, 1, vec![vec!["p".into(), receiver.clone()]]);
    let id = original.id.clone();
    e.store.insert(original.clone(), None);
    e.network.publish(
        "original".into(),
        original,
        lkjstr_core::engine::publication_plan::plan(
            lkjstr_core::engine::publication_plan::PublicationInput {
                own: vec![own.into()],
                ..Default::default()
            },
        ),
        0,
    );
    e.input(
        Input::Action {
            req: "delete".into(),
            account: event(1, 1, vec![]).pubkey,
            action: Action::Publish {
                kind: "delete".into(),
                content: String::new(),
                target: Some(id.clone()),
                tags: vec![],
            },
        },
        1000,
    );
    let unsigned = e
        .drain()
        .into_iter()
        .find_map(|o| match o {
            Output::Sign { event, .. } => Some(event),
            _ => None,
        })
        .expect("sign");
    let signed = finalize_event(
        &EventTemplate {
            pubkey: Some(unsigned.pubkey),
            created_at: unsigned.created_at,
            kind: unsigned.kind,
            tags: unsigned.tags,
            content: unsigned.content,
        },
        &parse_secret_key_hex(&"01".repeat(32)).expect("fixture"),
    )
    .expect("signed");
    e.input(
        Input::Signed {
            req: "delete".into(),
            event: Some(signed),
            error: None,
        },
        1001,
    );
    e.enqueue(
        own.into(),
        event(
            2,
            10002,
            vec![vec!["r".into(), "wss://late.test/".into(), "read".into()]],
        ),
    );
    e.tick(1002);
    e.network.connected(own, 1003);
    assert!(!e.network.pending_event(&id));
    assert!(!e.network.relays.contains_key("wss://late.test/"));
    assert!(!e.network.drain_effects().iter().any(|f|matches!(f,Effect::Send(_,t) if t.starts_with("[\"EVENT\"") && serde_json::from_str::<Value>(t).expect("frame")[1]["id"]==id)));
}
