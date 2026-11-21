#![allow(clippy::expect_used)]
mod engine_review_support;

use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::{Value, json};

#[test]
fn client_info_shares_exact_relay_read_and_uses_only_verified_latest_revision() {
    let mut engine = Engine::new();
    engine.network.configure(vec![RELAY.into()], 0);
    let key = generate_secret_key();
    let handler = |at, identifier: &str, content: Value| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind: 31990,
                tags: vec![vec!["d".into(), identifier.into()]],
                content: content.to_string(),
            },
            &key,
        )
        .expect("signed handler")
    };
    let old = handler(1, "App:identifier", json!({"name":"Old"}));
    let new = handler(
        2,
        "App:identifier",
        json!({"name":"Latest","website":"javascript:alert(1)"}),
    );
    let mut invalid = handler(
        3,
        "App:identifier",
        json!({"name":"Tampered","website":"https://wrong.test"}),
    );
    invalid.content.push('x');
    let other = handler(4, "app:identifier", json!({"name":"Wrong identifier"}));
    let wrong = event(5, 31990, r#"{"name":"Wrong author"}"#, old.tags.clone());
    let address = format!("31990:{}:App:identifier", old.pubkey);
    assert!(
        engine
            .ask_client_info(1, "first".into(), &address, 2)
            .is_none()
    );
    assert!(
        engine
            .ask_client_info(2, "second".into(), &address, 3)
            .is_none()
    );
    engine.network.connected(RELAY, 4);
    engine.tick(10);
    let requests = frames(&mut engine);
    assert_eq!(requests.len(), 1);
    let req = &requests[0];
    assert_eq!(req[0], "REQ");
    assert_eq!(req[2]["authors"], json!([old.pubkey]));
    assert_eq!(req[2]["kinds"], json!([31990]));
    assert_eq!(req[2]["#d"], json!(["App:identifier"]));
    for item in [invalid, old, new, wrong, other] {
        // Also exercise exact store matching when an event arrived by another route.
        engine.enqueue(RELAY.into(), item);
    }
    engine
        .network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 20);
    assert!(engine.drain_client_info().is_empty());
    engine.tick(21);
    let answers = engine.drain_client_info();
    assert_eq!(engine.rejected, 1);
    assert_eq!(
        answers.iter().map(|a| a.client).collect::<Vec<_>>(),
        vec![1, 2]
    );
    for answer in answers {
        let result = serde_json::to_value(wire::Session::client_info(answer)).expect("wire result");
        assert_eq!(result["clientInfo"], json!({"name":"Latest"}));
    }
    assert!(frames(&mut engine).iter().any(|f| f[0] == "CLOSE"));
    let cached = engine
        .ask_client_info(3, "cached".into(), &address, 30)
        .expect("already retained");
    assert_eq!(cached.handler.expect("handler").name, "Latest");
    assert!(frames(&mut engine).is_empty());
    let malformed = handler(
        6,
        "App:identifier",
        json!({"website":"https://without-name.test"}),
    );
    engine.enqueue(RELAY.into(), malformed);
    engine.tick(40);
    let answer = engine
        .ask_client_info(3, "malformed".into(), &address, 41)
        .expect("retained");
    assert!(answer.handler.is_none());
    let fresh = handler(
        7,
        "App:identifier",
        json!({"name":"Current","website":"https://example.test/app"}),
    );
    engine.enqueue(RELAY.into(), fresh);
    engine.tick(42);
    let answer = engine
        .ask_client_info(3, "fresh".into(), &address, 43)
        .expect("retained");
    assert_eq!(
        answer.handler.expect("handler").website.as_deref(),
        Some("https://example.test/app")
    );
}

#[test]
fn client_info_releases_detached_waiters_and_caches_misses() {
    let mut engine = Engine::new();
    let address = format!("31990:{}:missing", "a".repeat(64));
    let invalid = engine
        .ask_client_info(1, "invalid".into(), "31990:no:d", 0)
        .expect("malformed");
    assert!(invalid.handler.is_none());
    assert!(
        engine
            .ask_client_info(1, "drop".into(), &address, 1)
            .is_none()
    );
    engine.detach_client_info(1, 2);
    engine.tick(6001);
    assert!(engine.drain_client_info().is_empty());
    assert!(
        engine
            .ask_client_info(2, "look".into(), &address, 6100)
            .is_none()
    );
    engine.tick(12100);
    assert!(
        engine
            .drain_client_info()
            .pop()
            .expect("deadline answer")
            .handler
            .is_none()
    );
    assert!(
        engine
            .ask_client_info(2, "cached".into(), &address, 12101)
            .is_some()
    );
    assert!(
        engine
            .ask_client_info(2, "expired".into(), &address, 42101)
            .is_none()
    );
}
