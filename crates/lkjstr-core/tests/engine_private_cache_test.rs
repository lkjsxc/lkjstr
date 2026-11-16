use lkjstr_core::engine::{
    Engine, protocol as p,
    wire::{Input, Output, Session},
};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
use serde_json::{Value, json};
use std::collections::BTreeSet;
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn source(engine: &mut Engine, session: &mut Session, value: Value, at: u64) -> Result {
    let input: Input = serde_json::from_value(value)?;
    for input in session.input(input, engine).map_err(|(_, e)| e)? {
        engine.input(input, at);
    }
    Ok(())
}
fn route(session: &mut Session, engine: &Engine, outputs: Vec<p::Output>) -> Vec<Output> {
    outputs
        .into_iter()
        .flat_map(|out| session.output(out, engine))
        .collect()
}
#[test]
fn revoke_replaces_hidden_and_queued_private_rows_before_any_later_query() -> Result {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let mut owners = vec![];
    for (sub, word) in [("one", "private-one"), ("two", "private-two")] {
        let key = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
        let event = UnsignedEvent::new(
            key.public_key(),
            100,
            10000,
            vec![vec!["word".into(), format!("public-{sub}")]],
            "encrypted fixture",
        )
        .sign(&key, &[0; 32])?;
        let public = lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None)
            .map_err(|_| "fixture")?;
        engine.store.insert(public, None);
        engine
            .private_lists
            .insert(event.id, vec![vec!["word".into(), word.into()]]);
        source(
            &mut engine,
            &mut session,
            json!({"t":"open","sub":sub,
            "query":{"source":"mutes","account":key.public_key()}}),
            100_000,
        )?;
        owners.push(key.public_key());
    }
    let outputs = engine.drain();
    let initial = serde_json::to_string(&route(&mut session, &engine, outputs))?;
    assert!(initial.contains("private-one") && initial.contains("private-two"));
    source(
        &mut engine,
        &mut session,
        json!({"t":"hint","hint":{
        "visibleSubs":["two"],"pageHidden":false,"idle":false,"saveData":false}}),
        100_001,
    )?;
    // Keep a previously projected row snapshot queued while account access changes.
    source(
        &mut engine,
        &mut session,
        json!({"t":"window","sub":"one",
        "anchor":"top","before":0,"after":20}),
        100_002,
    )?;
    let allowed = BTreeSet::from([owners[1].clone()]);
    let replacement = engine
        .retain_private_accounts(&allowed, 100_003, false)
        .ok_or("no revocation")?;
    session.private_cache_changed(&engine);
    let replaced = serde_json::to_string(&route(&mut session, &engine, replacement))?;
    assert!(!replaced.contains("private-one"));
    assert!(replaced.contains("public-one") && replaced.contains("private-two"));
    let remaining = engine.drain();
    assert!(
        !serde_json::to_string(&route(&mut session, &engine, remaining))?.contains("private-one")
    );
    source(
        &mut engine,
        &mut session,
        json!({"t":"open","sub":"post-ack",
        "query":{"source":"mutes","account":owners[0]}}),
        100_004,
    )?;
    let fresh = engine.drain();
    assert!(!serde_json::to_string(&route(&mut session, &engine, fresh))?.contains("private-one"));
    assert_eq!(engine.private_lists.len(), 1);
    assert!(
        engine
            .retain_private_accounts(&allowed, 100_005, false)
            .is_none()
    );
    Ok(())
}
