#![allow(clippy::expect_used)]
use lkjstr_core::{
    cache::{Record, Restored, merge_metadata, metadata_rows},
    engine::Engine,
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};

type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn event(kind: u64, at: u64, content: &str) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            tags: vec![],
            content: content.into(),
        },
        &generate_secret_key(),
    )
    .expect("signed fixture")
}

#[test]
fn receipt_restores_exact_stored_note_before_a_verification_tick() -> Result {
    let note = event(1, 100, "seen before");
    let row = Record::verified(&note)?;
    assert!(matches!(row.restore()?, Restored::Verified(_)));
    let mut engine = Engine::new();
    engine.restore_cache(&[row.clone(), row]);
    assert_eq!(engine.store.get(&note.id).as_deref(), Some(&note));
    assert_eq!(engine.store.len(), 1);
    assert_eq!(engine.verified, 0);
    assert!(!engine.network.verifying);
    assert!(engine.pending.is_empty());
    Ok(())
}

#[test]
fn a_legacy_object_still_verifies_and_becomes_a_new_receipted_write() -> Result {
    let note = event(1, 100, "legacy");
    let row = Record {
        id: note.id.clone(),
        created_at: note.created_at,
        kind: None,
        raw: serde_json::to_string(&note)?,
        receipt: None,
    };
    let mut engine = Engine::new();
    engine.restore_cache(&[row]);
    assert!(engine.store.is_empty());
    assert!(engine.network.verifying);
    assert!(!engine.cached_history_complete);
    engine.tick(100_000);
    assert_eq!(engine.verified, 1);
    assert_eq!(engine.store.get(&note.id).as_deref(), Some(&note));
    let pending = engine.pending.batch();
    assert_eq!(pending.len(), 1);
    assert!(matches!(
        Record::verified(&pending[0])?.restore()?,
        Restored::Verified(_)
    ));
    Ok(())
}

#[test]
fn changed_compact_bytes_cannot_keep_the_old_verification_receipt() -> Result {
    let note = event(1, 100, "before");
    let mut row = Record::verified(&note)?;
    row.raw = row.raw.replace("before", "after");
    assert!(matches!(row.restore()?, Restored::Verify(_)));
    let mut engine = Engine::new();
    engine.restore_cache(&[row]);
    engine.tick(100_000);
    assert_eq!(engine.rejected, 1);
    assert!(engine.store.is_empty());
    assert!(engine.pending.is_empty());
    assert!(!engine.cached_history_complete);
    Ok(())
}

#[test]
fn mismatched_record_headers_and_unknown_receipts_use_verification() -> Result {
    let note = event(1, 100, "headers");
    for change in 0..5 {
        let mut row = Record::verified(&note)?;
        match change {
            0 => row.id = "0".repeat(64),
            1 => row.created_at += 1,
            2 => row.kind = Some(0),
            3 => row.receipt = Some("lkjstr-verified-999:unknown".into()),
            _ => row.receipt = None,
        }
        assert!(matches!(row.restore()?, Restored::Verify(_)));
        let mut engine = Engine::new();
        engine.restore_cache(&[row]);
        assert!(engine.store.is_empty());
        engine.tick(100_000);
        assert_eq!(engine.verified, 1);
        assert!(engine.store.get(&note.id).is_some());
    }
    Ok(())
}

#[test]
fn malformed_record_never_claims_complete_cached_history() -> Result {
    let mut row = Record::verified(&event(1, 100, "broken"))?;
    row.raw = "broken".into();
    let mut engine = Engine::new();
    engine.restore_cache(&[row]);
    assert!(engine.store.is_empty());
    assert!(!engine.cached_history_complete);
    Ok(())
}

#[test]
fn old_profile_checkpoint_is_available_before_newer_note_rows() -> Result {
    let profile = event(
        0,
        1,
        r#"{"name":"Already seen","picture":"https://example.test/avatar.png"}"#,
    );
    let checkpoint = merge_metadata(None, &[Record::verified(&profile)?])?;
    let mut engine = Engine::new();
    engine.restore_cache(&metadata_rows(Some(&checkpoint))?);
    let value = engine
        .store
        .profile(&profile.pubkey)
        .ok_or("profile missing")?;
    assert_eq!(value.name, "Already seen");
    assert_eq!(value.picture, "https://example.test/avatar.png");
    assert_eq!(engine.verified, 0);
    assert!(!engine.network.verifying);
    Ok(())
}
