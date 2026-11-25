#![allow(clippy::expect_used)]
use lkjstr_core::cache::{METADATA_BYTES, METADATA_EVENTS, Record, merge_metadata, metadata_rows};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};

fn event(
    secret: &SecretKeyBytes,
    kind: u64,
    at: u64,
    content: String,
    target: Option<&str>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            content,
            tags: target
                .map(|id| vec![vec!["e".into(), id.into()]])
                .unwrap_or_default(),
        },
        secret,
    )
    .expect("signed metadata witness fixture")
}
fn record(event: &NostrEvent) -> Record {
    Record::verified(event).expect("receipt")
}
fn profile(secret: &SecretKeyBytes, at: u64) -> NostrEvent {
    event(secret, 0, at, r#"{"name":"known"}"#.into(), None)
}
fn pressure(secret: &SecretKeyBytes) -> Vec<Record> {
    (0..8)
        .map(|n| {
            record(&event(
                secret,
                10_001 + n,
                n + 100,
                "x".repeat(700_000),
                None,
            ))
        })
        .collect()
}

#[test]
fn no_op_and_foreign_deletion_storms_cannot_permanently_stall_the_checkpoint() {
    let owner = generate_secret_key();
    let foreign = generate_secret_key();
    let original = profile(&owner, 1);
    let first = merge_metadata(None, &[record(&original)]).expect("initial metadata");
    let storm: Vec<_> = (0..METADATA_EVENTS + 1)
        .map(|n| {
            record(&event(
                &foreign,
                5,
                n as u64 + 2,
                String::new(),
                (n % 2 == 0).then_some(original.id.as_str()),
            ))
        })
        .collect();
    let raw =
        merge_metadata(Some(&first), &storm).expect("optional deletion storm remains bounded");
    let rows = metadata_rows(Some(&raw)).expect("valid bounded checkpoint");
    assert!(rows.len() <= METADATA_EVENTS && raw.len() <= METADATA_BYTES);
    assert!(
        rows.iter().any(|row| row.id == original.id),
        "foreign requests cannot remove metadata"
    );
    let newest = profile(&owner, 10_000);
    let next = merge_metadata(Some(&raw), &[record(&newest)]).expect("normal writes still commit");
    assert!(
        metadata_rows(Some(&next))
            .expect("next rows")
            .iter()
            .any(|row| row.id == newest.id)
    );
}

#[test]
fn redundant_valid_deletions_keep_one_witness_and_reject_a_later_stale_writer() {
    let owner = generate_secret_key();
    let original = profile(&owner, 1);
    let mut rows = vec![record(&original)];
    rows.extend((0..8).map(|n| {
        record(&event(
            &owner,
            5,
            n + 2,
            "x".repeat(700_000),
            Some(&original.id),
        ))
    }));
    let raw = merge_metadata(None, &rows)
        .expect("redundant signed deletions do not exhaust required pins");
    assert!(raw.len() <= METADATA_BYTES);
    let replay = merge_metadata(Some(&raw), &[record(&original)]).expect("stale writer");
    assert!(
        !metadata_rows(Some(&replay))
            .expect("rows")
            .iter()
            .any(|row| row.id == original.id)
    );
    let newest = rows.last().expect("latest deletion");
    assert!(
        metadata_rows(Some(&replay))
            .expect("rows")
            .iter()
            .any(|row| row.id == newest.id)
    );
}

#[test]
fn established_deletion_survives_body_removal_and_new_metadata_pressure() {
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let original = profile(&owner, 1);
    let deletion = event(&owner, 5, 2, "x".repeat(700_000), Some(&original.id));
    let first =
        merge_metadata(None, &[record(&original), record(&deletion)]).expect("established witness");
    assert!(
        !metadata_rows(Some(&first))
            .expect("rows")
            .iter()
            .any(|row| row.id == original.id)
    );
    let raw = merge_metadata(Some(&first), &pressure(&other)).expect("ordinary pressure");
    let replay = merge_metadata(Some(&raw), &[record(&original)]).expect("stale writer");
    let rows = metadata_rows(Some(&replay)).expect("rows");
    assert!(rows.iter().any(|row| row.id == deletion.id));
    assert!(!rows.iter().any(|row| row.id == original.id));
}

#[test]
fn legacy_witnesses_remain_conservative_until_their_original_body_arrives() {
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let original = profile(&owner, 1);
    let deletion = event(&owner, 5, 2, "x".repeat(700_000), Some(&original.id));
    let legacy = serde_json::json!({"version":1,"rows":[record(&deletion)]}).to_string();
    let raw = merge_metadata(Some(&legacy), &pressure(&other)).expect("legacy pressure");
    let replay = merge_metadata(Some(&raw), &[record(&original)]).expect("late original body");
    assert!(
        !metadata_rows(Some(&replay))
            .expect("rows")
            .iter()
            .any(|row| row.id == original.id)
    );
}

#[test]
fn unknown_note_target_keeps_a_witness_before_its_disk_body_is_restored() {
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let note = event(&owner, 1, 1, "disk body".into(), None);
    let deletion = event(&owner, 5, 2, "x".repeat(700_000), Some(&note.id));
    let first = merge_metadata(None, &[record(&deletion)]).expect("unknown target witness");
    let raw = merge_metadata(Some(&first), &pressure(&other)).expect("ordinary pressure");
    let rows = metadata_rows(Some(&raw)).expect("rows");
    assert!(rows.iter().any(|row| row.id == deletion.id));
    let mut engine = lkjstr_core::engine::Engine::new();
    engine.restore_cache(&rows);
    engine.restore_cache(&[record(&note)]);
    assert!(engine.store.get(&note.id).is_none());
}

#[test]
fn distinct_unknown_targets_overflow_explicitly_without_discarding_old_evidence() {
    let owner = generate_secret_key();
    let deletions: Vec<_> = (1..=7)
        .map(|n| {
            record(&event(
                &owner,
                5,
                n,
                "x".repeat(700_000),
                Some(&format!("{n:064x}")),
            ))
        })
        .collect();
    let first = merge_metadata(None, &deletions[..1]).expect("first possible target");
    assert!(merge_metadata(Some(&first), &deletions[1..]).is_err());
    assert_eq!(
        metadata_rows(Some(&first))
            .expect("unchanged valid checkpoint")
            .len(),
        1
    );
}

#[test]
fn proven_foreign_note_requests_do_not_become_unknown_pins_on_a_later_write() {
    let owner = generate_secret_key();
    let foreign = generate_secret_key();
    let rows: Vec<_> = (1..=7)
        .flat_map(|at| {
            let note = event(&owner, 1, at, "disk body".into(), None);
            let deletion = event(&foreign, 5, at + 10, "x".repeat(700_000), Some(&note.id));
            [record(&note), record(&deletion)]
        })
        .collect();
    let first = merge_metadata(None, &rows).expect("known foreign controls are not required");
    assert!(metadata_rows(Some(&first)).expect("rows").is_empty());
    let next = merge_metadata(Some(&first), &pressure(&owner)).expect("later writes still commit");
    assert!(next.len() <= METADATA_BYTES);
}
