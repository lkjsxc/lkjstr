//! Old metadata and held references require verification before minting a new receipt.
#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::cache::{Record, Restored, validate_metadata, validate_public_reference};
use lkjstr_protocol::generate_secret_key;
use support::*;
fn legacy(event: &lkjstr_protocol::NostrEvent) -> Record {
    Record {
        id: event.id.clone(),
        created_at: event.created_at,
        kind: None,
        raw: serde_json::to_string(event).expect("legacy JSON"),
        receipt: None,
    }
}
#[test]
fn an_old_profile_outside_the_newest_slice_can_be_verified_and_checkpointed() -> Result {
    let key = generate_secret_key();
    let profile = event(&key, 0, 1, "{\"name\":\"older name\"}", vec![]);
    let checked = validate_metadata(&legacy(&profile)).expect("valid old profile");
    assert!(matches!(checked.restore()?, Restored::Verified(restored) if restored == profile));
    let raw = lkjstr_core::cache::merge_metadata(None, &[checked])?;
    let mut engine = lkjstr_core::engine::Engine::new();
    engine.restore_cache(&lkjstr_core::cache::metadata_rows(Some(&raw))?);
    assert_eq!(
        engine
            .store
            .replaceable(&profile.pubkey, 0)
            .expect("restored profile")
            .id,
        profile.id
    );
    assert_eq!(engine.verified, 0);
    Ok(())
}
#[test]
fn tampered_or_unsupported_records_never_gain_a_public_receipt() {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut damaged = legacy(&note);
    damaged.raw = damaged.raw.replace("read before", "changed body");
    assert!(validate_public_reference(&damaged).is_none());
    assert!(validate_metadata(&legacy(&note)).is_none());
    for kind in [4, 13, 14, 59, 1059, 24133] {
        let raw = event(&key, kind, 1, "private or RPC", vec![]);
        assert!(validate_public_reference(&legacy(&raw)).is_none());
    }
}
#[test]
fn both_public_body_and_signed_deletion_are_verified_before_lazy_reconciliation() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let deleted = event(&key, 5, 2, "", vec![vec!["e".into(), note.id.clone()]]);
    let mut engine = lkjstr_core::engine::Engine::new();
    engine.restore_cache(&[validate_metadata(&legacy(&deleted)).expect("verified fence")]);
    assert!(!engine.store.verified_deleted(&note.id));
    engine.restore_cache(&[validate_public_reference(&legacy(&note)).expect("verified old body")]);
    assert!(engine.store.verified_deleted(&note.id));
    assert!(engine.store.get(&note.id).is_none());
    Ok(())
}
