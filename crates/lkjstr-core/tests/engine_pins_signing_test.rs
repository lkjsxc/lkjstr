#![allow(clippy::expect_used)]
#[path = "engine_pins/support.rs"]
mod support;
use lkjstr_core::engine::{Engine, protocol::Output};
use support::*;

#[test]
fn pending_edits_are_serialized_and_the_next_edit_uses_the_signed_list() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    let a = event(1, 1, 1, "A", vec![]);
    let b = event(1, 1, 2, "B", vec![]);
    engine.store.insert(a.clone(), None);
    engine.store.insert(b.clone(), None);
    engine.store.insert(event(1, 10001, 3, "", vec![]), None);
    let first = unsigned(request(&mut engine, "a", &a.pubkey, &a.id, true));
    error(
        request(&mut engine, "b", &a.pubkey, &b.id, true),
        "list-edit-pending",
    );
    finish(&mut engine, "a", 1, first);
    let next = unsigned(request(&mut engine, "b", &a.pubkey, &b.id, true));
    assert_eq!(next.tags, vec![pin_tag(&a.id), pin_tag(&b.id)]);
    assert_eq!(next.created_at, 101);
}

#[test]
fn a_newer_list_received_while_signing_blocks_publication_and_allows_a_fresh_merge() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    let own = event(1, 1, 1, "own", vec![]);
    let other = event(2, 1, 2, "existing external pin", vec![]);
    engine.store.insert(own.clone(), None);
    engine.store.insert(event(1, 10001, 10, "", vec![]), None);
    let stale = unsigned(request(&mut engine, "pin", &own.pubkey, &own.id, true));
    let tags = vec![pin_tag(&other.id), vec!["remote".into(), "keep".into()]];
    let latest = event(1, 10001, 200, "remote extension", tags.clone());
    engine.enqueue(OTHER.into(), latest.clone());
    engine.tick(NOW + 2);
    engine.drain();
    frames(&mut engine);
    error(finish(&mut engine, "pin", 1, stale), "stale-list");
    assert!(!frames(&mut engine).iter().any(|frame| frame[0] == "EVENT"));
    assert_eq!(
        engine
            .store
            .replaceable(&own.pubkey, 10001)
            .expect("latest list")
            .id,
        latest.id
    );
    let retry = unsigned(request(&mut engine, "retry", &own.pubkey, &own.id, true));
    let mut expected = tags;
    expected.push(pin_tag(&own.id));
    assert_eq!(retry.tags, expected);
    assert_eq!(retry.content, "remote extension");
    assert_eq!(retry.created_at, 201);
}

#[test]
fn an_equal_time_lexical_winner_also_invalidates_a_pending_signature() {
    let mut engine = Engine::new();
    let own = event(1, 1, 1, "own", vec![]);
    engine.store.insert(own.clone(), None);
    let a = event(1, 10001, 10, "", vec![vec!["x".into(), "a".into()]]);
    let b = event(1, 10001, 10, "", vec![vec!["x".into(), "b".into()]]);
    let (winner, loser) = if a.id < b.id { (a, b) } else { (b, a) };
    engine.store.insert(loser, None);
    let stale = unsigned(request(&mut engine, "pin", &own.pubkey, &own.id, true));
    engine.store.insert(winner.clone(), Some(OTHER));
    error(finish(&mut engine, "pin", 1, stale), "stale-list");
    assert_eq!(
        engine
            .store
            .replaceable(&own.pubkey, 10001)
            .expect("winner")
            .id,
        winner.id
    );
}

#[test]
fn proven_absence_is_rechecked_if_a_list_arrives_while_the_signer_is_open() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    let own = event(1, 1, 1, "own", vec![]);
    engine.store.insert(own.clone(), None);
    let pending = request(&mut engine, "first", &own.pubkey, &own.id, true);
    assert!(!pending.iter().any(|out| matches!(out, Output::Sign { .. })));
    engine.network.connected(RELAY, NOW + 1);
    engine.tick(NOW + 100);
    let sent = frames(&mut engine);
    let lookup = filter_for(&sent, 10001);
    eose(&mut engine, RELAY, lookup, NOW + 101);
    engine.tick(NOW + 102);
    let draft = unsigned(engine.drain());
    assert!(engine.store.replaceable(&own.pubkey, 10001).is_none());
    let latest = event(
        1,
        10001,
        20,
        "other device",
        vec![vec!["x".into(), "keep".into()]],
    );
    engine.store.insert(latest.clone(), Some(OTHER));
    frames(&mut engine);
    error(finish(&mut engine, "first", 1, draft), "stale-list");
    assert!(!frames(&mut engine).iter().any(|frame| frame[0] == "EVENT"));
    assert_eq!(
        engine
            .store
            .replaceable(&own.pubkey, 10001)
            .expect("remote list")
            .id,
        latest.id
    );
}

#[test]
fn malformed_signer_reply_cannot_replace_the_verified_pin_list() {
    let mut engine = Engine::new();
    let own = event(1, 1, 1, "own", vec![]);
    let previous = event(1, 10001, 10, "keep", vec![]);
    engine.store.insert(own.clone(), None);
    engine.store.insert(previous.clone(), None);
    let mut draft = unsigned(request(&mut engine, "pin", &own.pubkey, &own.id, true));
    draft.content = "signer changed content".into();
    error(
        finish(&mut engine, "pin", 1, draft),
        "invalid-signer-response",
    );
    assert_eq!(
        engine
            .store
            .replaceable(&own.pubkey, 10001)
            .expect("previous list")
            .id,
        previous.id
    );
}
