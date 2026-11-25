#![allow(clippy::expect_used)]
use lkjstr_core::{
    cache::{METADATA_BYTES, Record, merge_metadata, metadata_rows},
    engine::Engine,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};

fn event(
    secret: &SecretKeyBytes,
    kind: u64,
    at: u64,
    content: String,
    address: Option<&str>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            content,
            tags: address
                .map(|a| vec![vec!["a".into(), a.into()]])
                .unwrap_or_default(),
        },
        secret,
    )
    .expect("signed address witness fixture")
}
fn record(event: &NostrEvent) -> Record {
    Record::verified(event).expect("receipt")
}

#[test]
fn repeated_address_deletions_keep_the_latest_cutoff_under_pressure() {
    let owner = generate_secret_key();
    let old = event(&owner, 0, 8, r#"{"name":"old"}"#.into(), None);
    let fresh = event(&owner, 0, 10, r#"{"name":"fresh"}"#.into(), None);
    let address = format!("0:{}:", old.pubkey);
    let rows: Vec<_> = (2..=9)
        .map(|at| record(&event(&owner, 5, at, "x".repeat(700_000), Some(&address))))
        .collect();
    let first = merge_metadata(None, &rows).expect("one latest cutoff is sufficient");
    assert!(first.len() <= METADATA_BYTES);
    let pressure: Vec<_> = (0..8)
        .map(|n| {
            record(&event(
                &owner,
                10_001 + n,
                100 + n,
                "y".repeat(700_000),
                None,
            ))
        })
        .collect();
    let raw = merge_metadata(Some(&first), &pressure).expect("ordinary pressure");
    let retained = metadata_rows(Some(&raw)).expect("rows");
    assert!(
        retained
            .iter()
            .any(|row| row.id == rows.last().expect("latest cutoff").id)
    );
    let mut engine = Engine::new();
    engine.restore_cache(&retained);
    engine.restore_cache(&[record(&old)]);
    assert!(engine.store.get(&old.id).is_none());
    engine.restore_cache(&[record(&fresh)]);
    assert_eq!(engine.store.get(&fresh.id).as_deref(), Some(&fresh));
}

#[test]
fn invalid_and_foreign_address_requests_are_not_required_witnesses() {
    let owner = generate_secret_key();
    let foreign = generate_secret_key();
    let profile = event(&owner, 0, 1, r#"{"name":"owner"}"#.into(), None);
    let address = format!("0:{}:", profile.pubkey);
    let mut rows = vec![record(&profile)];
    rows.extend((2..=8).map(|at| {
        let target = if at % 2 == 0 {
            address.as_str()
        } else {
            "invalid"
        };
        record(&event(&foreign, 5, at, "x".repeat(700_000), Some(target)))
    }));
    let raw = merge_metadata(None, &rows).expect("no required address evidence");
    assert!(raw.len() <= METADATA_BYTES);
    let mut engine = Engine::new();
    engine.restore_cache(&metadata_rows(Some(&raw)).expect("rows"));
    assert_eq!(engine.store.get(&profile.id).as_deref(), Some(&profile));
}
