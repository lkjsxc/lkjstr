#![allow(clippy::expect_used)]
use lkjstr_core::cache::{METADATA_BYTES, METADATA_EVENTS, Record, merge_metadata, metadata_rows};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};

type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn signed(secret: &lkjstr_protocol::SecretKeyBytes, kind: u64, at: u64, text: &str) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            tags: vec![],
            content: text.into(),
        },
        secret,
    )
    .expect("signed metadata fixture")
}

#[test]
fn concurrent_old_metadata_cannot_replace_newer_author_kind_state() -> Result {
    let secret = generate_secret_key();
    let old = Record::verified(&signed(&secret, 0, 1, "old"))?;
    let newest = Record::verified(&signed(&secret, 0, 3, "newest"))?;
    let stale = Record::verified(&signed(&secret, 0, 2, "stale"))?;
    let first = merge_metadata(None, &[old])?;
    let second = merge_metadata(Some(&first), std::slice::from_ref(&newest))?;
    let third = merge_metadata(Some(&second), &[stale])?;
    assert_eq!(
        metadata_rows(Some(&third))?
            .iter()
            .map(|r| &r.id)
            .collect::<Vec<_>>(),
        vec![&newest.id]
    );
    Ok(())
}

#[test]
fn replaceable_ties_choose_the_lowest_id_in_either_write_order() -> Result {
    let secret = generate_secret_key();
    let mut rows = [
        Record::verified(&signed(&secret, 3, 20, "a"))?,
        Record::verified(&signed(&secret, 3, 20, "b"))?,
    ];
    rows.sort_by(|a, b| a.id.cmp(&b.id));
    for order in [[&rows[0], &rows[1]], [&rows[1], &rows[0]]] {
        let first = merge_metadata(None, &[order[0].clone()])?;
        let second = merge_metadata(Some(&first), &[order[1].clone()])?;
        assert_eq!(metadata_rows(Some(&second))?[0].id, rows[0].id);
    }
    Ok(())
}

#[test]
fn unknown_or_corrupt_receipts_never_gain_trust_during_checkpoint_merge() -> Result {
    let secret = generate_secret_key();
    let mut row = Record::verified(&signed(&secret, 0, 1, "before"))?;
    row.raw = row.raw.replace("before", "after");
    let previous = serde_json::json!({"version":1,"rows":[row]}).to_string();
    assert_eq!(metadata_rows(Some(&previous))?.len(), 1);
    assert!(metadata_rows(Some(&merge_metadata(Some(&previous), &[])?))?.is_empty());
    Ok(())
}

#[test]
fn checkpoint_keeps_metadata_only_and_recency_is_not_event_timestamp() -> Result {
    let secret = generate_secret_key();
    let note = Record::verified(&signed(&secret, 1, 999, "ordinary"))?;
    let old_profile = Record::verified(&signed(&secret, 0, 1, "old profile"))?;
    let newer_follow = Record::verified(&signed(&secret, 3, 100, "follow"))?;
    let first = merge_metadata(None, &[newer_follow.clone(), note])?;
    let second = merge_metadata(Some(&first), std::slice::from_ref(&old_profile))?;
    let rows = metadata_rows(Some(&second))?;
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].id, old_profile.id);
    assert_eq!(rows[1].id, newer_follow.id);
    Ok(())
}

#[test]
fn exact_encoded_byte_and_event_budgets_bound_the_checkpoint() -> Result {
    let secret = generate_secret_key();
    let large: Vec<_> = (0..8)
        .map(|n| Record::verified(&signed(&secret, 10_000 + n, n, &"payload".repeat(120_000))))
        .collect::<std::result::Result<_, _>>()?;
    let raw = merge_metadata(None, &large)?;
    assert!(raw.len() <= METADATA_BYTES);
    assert!(metadata_rows(Some(&raw))?.len() < large.len());
    let many: Vec<_> = (0..METADATA_EVENTS + 1)
        .map(|n| Record::verified(&signed(&secret, 10_000 + n as u64, n as u64, "small")))
        .collect::<std::result::Result<_, _>>()?;
    let raw = merge_metadata(None, &many)?;
    assert_eq!(metadata_rows(Some(&raw))?.len(), METADATA_EVENTS);
    assert!(raw.len() <= METADATA_BYTES);
    Ok(())
}

#[test]
fn malformed_oversized_or_newer_checkpoint_formats_are_not_silently_trusted() {
    assert!(metadata_rows(Some("{")).is_err());
    assert!(metadata_rows(Some(r#"{"version":3,"rows":[]}"#)).is_err());
    assert!(metadata_rows(Some(&" ".repeat(METADATA_BYTES + 1))).is_err());
}

#[test]
fn signed_deletion_fences_outlive_a_stale_metadata_writer() -> Result {
    let secret = generate_secret_key();
    let profile = signed(&secret, 0, 1, "deleted profile");
    let deletion = |owner: &lkjstr_protocol::SecretKeyBytes| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                kind: 5,
                created_at: 2,
                tags: vec![vec!["e".into(), profile.id.clone()]],
                content: String::new(),
            },
            owner,
        )
        .expect("signed deletion fixture")
    };
    let stored = Record::verified(&profile)?;
    let first = merge_metadata(None, std::slice::from_ref(&stored))?;
    let foreign = Record::verified(&deletion(&generate_secret_key()))?;
    let ignored = merge_metadata(Some(&first), &[foreign])?;
    assert!(
        metadata_rows(Some(&ignored))?
            .iter()
            .any(|row| row.id == profile.id)
    );
    let own = Record::verified(&deletion(&secret))?;
    let deleted = merge_metadata(Some(&ignored), std::slice::from_ref(&own))?;
    let stale = merge_metadata(Some(&deleted), std::slice::from_ref(&stored))?;
    let rows = metadata_rows(Some(&stale))?;
    assert!(rows.iter().any(|row| row.id == own.id));
    assert!(!rows.iter().any(|row| row.id == profile.id));
    let mut engine = lkjstr_core::engine::Engine::new();
    engine.restore_cache(&rows);
    engine.restore_cache(&[stored]);
    assert!(engine.store.profile(&profile.pubkey).is_none());
    assert!(engine.store.get(&profile.id).is_none());
    Ok(())
}
