#![allow(clippy::expect_used)]
use lkjstr_core::cache::{
    METADATA_BYTES, MetadataAccess, Record, merge_metadata, merge_metadata_with_access,
    metadata_rows,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};

fn event(
    secret: &SecretKeyBytes,
    kind: u64,
    at: u64,
    content: String,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            content,
            tags,
        },
        secret,
    )
    .expect("signed cache fixture")
}
fn record(event: &NostrEvent) -> Record {
    Record::verified(event).expect("verified record")
}
fn pressure(secret: &SecretKeyBytes) -> Vec<Record> {
    (0..8)
        .map(|n| {
            record(&event(
                secret,
                10_001 + n,
                10 + n,
                "x".repeat(700_000),
                vec![],
            ))
        })
        .collect()
}
fn visible(secret: &SecretKeyBytes) -> NostrEvent {
    event(
        secret,
        0,
        1,
        serde_json::json!({"name":"known", "about":"x".repeat(700_000)}).to_string(),
        vec![],
    )
}

#[test]
fn checkpoint_pressure_uses_visible_reuse_instead_of_newest_observation() {
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let profile = visible(&owner);
    let mut access = MetadataAccess {
        minute: 30_000_000,
        ..Default::default()
    };
    access.authors.insert(profile.pubkey.clone(), 64);
    let first =
        merge_metadata_with_access(None, &[record(&profile)], &access).expect("initial checkpoint");
    let raw = merge_metadata_with_access(Some(&first), &pressure(&other), &access)
        .expect("pressured checkpoint");
    let rows = metadata_rows(Some(&raw)).expect("bounded checkpoint");
    assert!(raw.len() <= METADATA_BYTES);
    assert!(
        rows.iter().any(|row| row.id == profile.id),
        "an old displayed name wins over unrelated large lists"
    );
    assert!(
        rows.len() < 9,
        "the byte budget still evicts optional entries"
    );
}

#[test]
fn a_stale_writer_cannot_erase_newer_access_observations() {
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let profile = visible(&owner);
    let mut recent = MetadataAccess {
        minute: 100,
        ..Default::default()
    };
    recent.authors.insert(profile.pubkey.clone(), 64);
    let first =
        merge_metadata_with_access(None, &[record(&profile)], &recent).expect("recent access");
    let mut old = MetadataAccess {
        minute: 90,
        ..Default::default()
    };
    old.authors.insert(profile.pubkey.clone(), 1);
    let stale =
        merge_metadata_with_access(Some(&first), &[record(&profile)], &old).expect("stale writer");
    let current = MetadataAccess {
        minute: 100,
        ..Default::default()
    };
    let result =
        merge_metadata_with_access(Some(&stale), &pressure(&other), &current).expect("pressure");
    assert!(
        metadata_rows(Some(&result))
            .expect("rows")
            .iter()
            .any(|row| row.id == profile.id)
    );
}

#[test]
fn pressure_keeps_deletion_authority_before_optional_metadata() {
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let profile = visible(&owner);
    let deletion = event(
        &owner,
        5,
        2,
        String::new(),
        vec![vec!["e".into(), profile.id.clone()]],
    );
    let mut access = MetadataAccess {
        minute: 100,
        ..Default::default()
    };
    access.authors.insert(profile.pubkey.clone(), 64);
    let first = merge_metadata_with_access(None, &[record(&profile), record(&deletion)], &access)
        .expect("deletion checkpoint");
    let mut incoming = pressure(&other);
    incoming.push(record(&profile));
    let raw =
        merge_metadata_with_access(Some(&first), &incoming, &access).expect("pressured deletion");
    let rows = metadata_rows(Some(&raw)).expect("rows");
    assert!(rows.iter().any(|row| row.id == deletion.id));
    assert!(!rows.iter().any(|row| row.id == profile.id));
    assert!(raw.len() <= METADATA_BYTES);
}

#[test]
fn required_evidence_overflow_refuses_optional_admission_without_oversized_state() {
    let required: Vec<_> = (0..7)
        .flat_map(|n| {
            let owner = generate_secret_key();
            let profile = event(&owner, 0, n * 2, r#"{"name":"known"}"#.into(), vec![]);
            let deletion = event(
                &owner,
                5,
                n * 2 + 1,
                "x".repeat(700_000),
                vec![vec!["e".into(), profile.id.clone()]],
            );
            [record(&profile), record(&deletion)]
        })
        .collect();
    let previous = merge_metadata(None, &required[..2]).expect("committed witness");
    assert!(merge_metadata(Some(&previous), &required[2..]).is_err());
    assert!(previous.len() <= METADATA_BYTES);
    assert_eq!(
        metadata_rows(Some(&previous))
            .expect("old commit remains valid")
            .len(),
        1
    );
}
