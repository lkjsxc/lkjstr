#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
#[path = "engine_profile_save/wire.rs"]
mod wire;

use lkjstr_core::engine::{
    Engine,
    protocol::{Action, Input, Output},
};
use lkjstr_protocol::{NostrEvent, SecretKeyBytes, UnsignedNostrEvent, generate_secret_key};
use serde_json::{Value, json};

fn request(engine: &mut Engine, account: &str, content: &str) -> Vec<Output> {
    engine.input(
        Input::Action {
            req: "save".into(),
            account: account.into(),
            action: Action::ProfileSave {
                content: content.into(),
            },
        },
        50_000,
    );
    engine.drain()
}

fn unsigned(outputs: Vec<Output>) -> UnsignedNostrEvent {
    outputs
        .into_iter()
        .find_map(|output| match output {
            Output::Sign { event, .. } => Some(event),
            _ => None,
        })
        .expect("save reaches signer")
}

fn sign(key: &SecretKeyBytes, draft: UnsignedNostrEvent) -> NostrEvent {
    support::event(
        key,
        draft.kind,
        draft.created_at,
        &draft.content,
        draft.tags,
    )
}

fn assert_rejected(outputs: Vec<Output>, expected: &str) {
    assert!(matches!(outputs.as_slice(), [Output::Error { code, .. }] if code == expected));
}

#[test]
fn unchanged_display_label_keeps_the_handle_and_can_be_changed_to_the_handle() {
    let mut engine = Engine::new();
    let key = generate_secret_key();
    let previous = support::event(
        &key,
        0,
        1,
        r#"{"name":"handle","username":"old handle","displayName":"Display","about":"bio"}"#,
        vec![],
    );
    let account = previous.pubkey.clone();
    engine.store.insert(previous, None);
    let unchanged = unsigned(request(
        &mut engine,
        &account,
        r#"{"name":"Display","lud16":"new@pay.test"}"#,
    ));
    assert_eq!(unchanged.created_at, 50);
    assert_eq!(
        serde_json::from_str::<Value>(&unchanged.content).expect("object"),
        json!({
            "name":"handle","username":"old handle","displayName":"Display","about":"bio","lud16":"new@pay.test"
        })
    );
    engine.input(
        Input::Signed {
            req: "save".into(),
            event: Some(sign(&key, unchanged)),
            error: None,
        },
        50_001,
    );
    let changed = unsigned(request(&mut engine, &account, r#"{"name":"handle"}"#));
    assert_eq!(changed.created_at, 51);
    assert_eq!(
        lkjstr_core::store::Profile::parse(&changed.content).label(),
        Some("handle")
    );
    assert_eq!(
        changed.content,
        r#"{"about":"bio","name":"handle","username":"old handle"}"#,
    );
    engine.input(
        Input::Signed {
            req: "save".into(),
            event: Some(sign(&key, changed)),
            error: None,
        },
        50_002,
    );
    let cleared = unsigned(request(
        &mut engine,
        &account,
        r#"{"name":"  ","about":null}"#,
    ));
    assert_eq!(cleared.created_at, 52);
    assert_eq!(cleared.content, r#"{"name":"","username":"old handle"}"#);
    assert_eq!(
        lkjstr_core::store::Profile::parse(&cleared.content).label(),
        None
    );
}

#[test]
fn first_save_and_save_over_malformed_metadata_start_from_an_empty_object() {
    let key = generate_secret_key();
    for prior in [None, Some("broken JSON"), Some("[]")] {
        let mut engine = Engine::new();
        let previous = support::event(&key, 0, 100, prior.unwrap_or_default(), vec![]);
        let account = previous.pubkey.clone();
        if prior.is_some() {
            engine.store.insert(previous, None);
        }
        let event = unsigned(request(
            &mut engine,
            &account,
            r#"{"name":"First","picture":"https://media.test/new.png"}"#,
        ));
        assert_eq!(event.kind, 0);
        assert_eq!(event.created_at, if prior.is_some() { 101 } else { 50 });
        assert_eq!(
            event.content,
            r#"{"name":"First","picture":"https://media.test/new.png"}"#
        );
    }
}

#[test]
fn invalid_or_oversized_profiles_do_not_reach_the_signer() {
    let mut engine = Engine::new();
    let key = generate_secret_key();
    let previous = support::event(
        &key,
        0,
        100,
        &json!({"privateExtension":"x".repeat(65_500)}).to_string(),
        vec![],
    );
    let account = previous.pubkey.clone();
    engine.store.insert(previous, None);
    for content in ["{", "[]", "null", r#"{"name":false}"#] {
        assert_rejected(request(&mut engine, &account, content), "invalid-profile");
    }
    let oversized_input = json!({"ignored":"x".repeat(65_536)}).to_string();
    assert_rejected(
        request(&mut engine, &account, &oversized_input),
        "event-too-large",
    );
    let oversized_merge = json!({"about":"x".repeat(30)}).to_string();
    assert_rejected(
        request(&mut engine, &account, &oversized_merge),
        "event-too-large",
    );
    engine
        .store
        .insert(support::event(&key, 0, u64::MAX, "{}", vec![]), None);
    assert_rejected(request(&mut engine, &account, "{}"), "rejected");
    assert!(engine.pending.is_empty());
}

#[test]
fn pending_profile_edits_are_serialized_and_a_changed_base_requires_a_fresh_save() {
    let mut engine = Engine::new();
    let key = generate_secret_key();
    let original = support::event(&key, 0, 10, r#"{"extension":"original"}"#, vec![]);
    let incoming = support::event(&key, 0, 20, r#"{"extension":"newer"}"#, vec![]);
    let account = original.pubkey.clone();
    engine.store.insert(original, None);
    let draft = unsigned(request(&mut engine, &account, r#"{"name":"edit"}"#));
    engine.input(
        Input::Action {
            req: "overlap".into(),
            account: account.clone(),
            action: Action::ProfileSave {
                content: r#"{"name":"overlap"}"#.into(),
            },
        },
        50_001,
    );
    assert_rejected(engine.drain(), "profile-edit-pending");
    engine.enqueue("cache".into(), incoming.clone());
    engine.tick(50_002);
    engine.drain();
    engine.input(
        Input::Signed {
            req: "save".into(),
            event: Some(sign(&key, draft)),
            error: None,
        },
        50_003,
    );
    assert_rejected(engine.drain(), "stale-profile");
    assert!(engine.pending.is_empty());
    assert_eq!(
        engine
            .store
            .replaceable(&account, 0)
            .expect("current profile")
            .id,
        incoming.id
    );
    let retry = unsigned(request(&mut engine, &account, r#"{"name":"edit"}"#));
    assert_eq!(retry.content, r#"{"extension":"newer","name":"edit"}"#);
}
