#![allow(clippy::expect_used)]
use lkjstr_core::{
    cache::{self, MetadataAccess, Record},
    persistence::PendingEvents,
    store::Store,
};
use lkjstr_protocol::NostrEvent;

fn event(id: u64, kind: u64, at: u64, bytes: usize, targets: &[u64]) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: format!("{:064x}", 1),
        kind,
        created_at: at,
        content: "x".repeat(bytes),
        tags: targets
            .iter()
            .map(|id| vec!["e".into(), format!("{id:064x}")])
            .collect(),
        sig: "0".repeat(128),
    }
}
fn row(event: &NostrEvent) -> Record {
    Record::verified(event).expect("post-verification fixture")
}
fn proofs() -> Vec<Record> {
    (1..=7)
        .map(|i| row(&event(i, 5, i, 700_000, &[100 + i])))
        .collect()
}
#[test]
fn proof_floor_moves_existing_signed_bodies_to_references_and_collapses_after_supersession() {
    let rows = proofs();
    let before = cache::merge_metadata(None, &rows[..5]).expect("bounded prior checkpoint");
    assert!(cache::merge_metadata(Some(&before), &rows[5..]).is_err());
    let recovered =
        cache::recover_metadata(Some(&before), &[], &rows[5..], &MetadataAccess::default())
            .expect("proof floor recovery");
    assert!(recovered.encoded.len() <= cache::METADATA_BYTES);
    assert_eq!(
        cache::metadata_references(Some(&recovered.encoded))
            .expect("refs")
            .len(),
        7
    );
    assert_eq!(
        recovered.required.len(),
        7,
        "old checkpoint-only bodies must also be installed"
    );
    assert!(
        cache::metadata_rows(Some(&recovered.encoded)).is_err(),
        "unresolved proof is never empty"
    );
    assert!(
        cache::merge_metadata(Some(&recovered.encoded), &[]).is_err(),
        "inline-only writers cannot erase references"
    );
    let restored = cache::resolve_metadata(Some(&recovered.encoded), &recovered.required)
        .expect("complete proofs");
    let mut store = Store::new(100);
    for row in restored {
        if let cache::Restored::Verified(event) = row.restore().expect("receipt") {
            store.insert(event, None);
        }
    }
    for id in 101..=107 {
        assert_eq!(
            store.insert(event(id, 1, 0, 0, &[]), None),
            lkjstr_core::store::Inserted::Deleted
        );
    }
    let replacement = row(&event(20, 5, 100, 0, &(101..=107).collect::<Vec<_>>()));
    let collapsed = cache::recover_metadata(
        Some(&recovered.encoded),
        &recovered.required,
        std::slice::from_ref(&replacement),
        &MetadataAccess::default(),
    )
    .expect("compact sufficient witness");
    assert!(collapsed.required.is_empty());
    let rows = cache::metadata_rows(Some(&collapsed.encoded)).expect("inline again");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].id, replacement.id);
    let stale = cache::recover_metadata(
        Some(&collapsed.encoded),
        &[],
        &proofs(),
        &MetadataAccess::default(),
    )
    .expect("stale writer");
    assert_eq!(
        cache::metadata_rows(Some(&stale.encoded)).expect("rows")[0].id,
        replacement.id
    );
}
#[test]
fn missing_modified_duplicate_and_wrong_receipt_references_fail_closed() {
    let commit =
        cache::recover_metadata(None, &[], &proofs(), &MetadataAccess::default()).expect("spill");
    assert!(cache::resolve_metadata(Some(&commit.encoded), &commit.required[..6]).is_err());
    let mut changed = commit.required.clone();
    changed[0].raw.push(' ');
    assert!(cache::resolve_metadata(Some(&commit.encoded), &changed).is_err());
    let mut changed = commit.required.clone();
    changed[0].receipt = Some("different".into());
    assert!(cache::resolve_metadata(Some(&commit.encoded), &changed).is_err());
    let mut checkpoint: serde_json::Value = serde_json::from_str(&commit.encoded).expect("json");
    let duplicate = checkpoint["required"][0].clone();
    checkpoint["required"]
        .as_array_mut()
        .expect("references")
        .push(duplicate);
    assert!(cache::resolve_metadata(Some(&checkpoint.to_string()), &commit.required).is_err());
    assert!(
        cache::recover_metadata(Some(&commit.encoded), &[], &[], &MetadataAccess::default())
            .is_err()
    );
}
#[test]
fn control_recovery_reaches_a_superseding_witness_behind_the_fifo_batch() {
    let mut pending = PendingEvents::default();
    for id in 1..=700 {
        assert!(pending.push(event(id, 1, id, 0, &[]), true));
    }
    let proof = event(701, 5, 900, 0, &[42]);
    assert!(pending.push(proof.clone(), true));
    assert!(pending.batch().iter().all(|row| row.kind == 1));
    assert!(pending.recovery_batch().is_empty());
    assert!(pending.recovery_batch().is_empty());
    let control = pending.recovery_batch();
    assert_eq!(control.len(), 1);
    assert_eq!(control[0].id_hex(), proof.id);
    assert_eq!(
        pending.len(),
        701,
        "selection does not acknowledge an aborted write"
    );
    pending.committed(&control);
    assert_eq!(pending.len(), 700);
}
#[test]
fn foreign_deletion_cannot_use_recovery_to_remove_verified_metadata() {
    let mut profile = event(99, 0, 10, 0, &[]);
    profile.pubkey = format!("{:064x}", 2);
    let mut rows = proofs();
    rows.push(row(&profile));
    rows.push(row(&event(1000, 5, 50, 0, &[99])));
    let commit =
        cache::recover_metadata(None, &[], &rows, &MetadataAccess::default()).expect("recovery");
    let restored =
        cache::resolve_metadata(Some(&commit.encoded), &commit.required).expect("resolved");
    assert!(restored.iter().any(|row| row.id == profile.id));
    assert!(
        !restored
            .iter()
            .any(|row| row.id == format!("{:064x}", 1000))
    );
}

#[test]
fn required_witness_bodies_survive_deletion_of_the_witness_itself() {
    use cache::durable::{Access, Hint, Scan, State};
    use lkjstr_core::optimizer::retention::Target;
    let mut rows = proofs();
    rows.push(row(&event(20, 5, 100, 0, &[1])));
    let commit = cache::recover_metadata(None, &[], &rows, &MetadataAccess::default())
        .expect("reference checkpoint");
    let metadata = cache::resolve_metadata(Some(&commit.encoded), &commit.required)
        .expect("required authority");
    let state = State {
        epoch: Some((
            0,
            0,
            Target {
                regular: 1,
                replaceable: 1,
                total: 1,
                bytes: usize::MAX,
            },
        )),
        ..Default::default()
    };
    let mut scan = Scan::new(state, Access::default(), &metadata);
    scan.required.extend(
        cache::metadata_references(Some(&commit.encoded))
            .expect("references")
            .into_iter()
            .map(|reference| reference.id),
    );
    let optional = row(&event(900, 1, 0, 0, &[]));
    for record in commit.required.iter().chain([&optional]) {
        scan.push(record, Hint::default());
    }
    let victims = scan.victims(256, &Default::default());
    assert_eq!(victims.len(), 1);
    assert_eq!(victims[0].id, optional.id);
    let remaining: Vec<_> = commit
        .required
        .into_iter()
        .filter(|record| !victims.iter().any(|victim| victim.id == record.id))
        .collect();
    assert!(cache::resolve_metadata(Some(&commit.encoded), &remaining).is_ok());
    for reverse in [false, true] {
        let mut ordered = metadata.clone();
        ordered.push(row(&event(20, 5, 100, 0, &[1])));
        if reverse {
            ordered.reverse();
        }
        let mut engine = lkjstr_core::engine::Engine::new();
        engine.restore_cache(&ordered);
        engine.restore_cache(&[row(&event(101, 1, 0, 0, &[]))]);
        assert!(engine.store.get(&format!("{:064x}", 101)).is_none());
        assert!(engine.store.get(&format!("{:064x}", 1)).is_some());
    }
}
#[test]
fn failed_small_control_cannot_starve_a_larger_reducing_witness() {
    let mut pending = PendingEvents::default();
    let small = event(1, 5, 1, 0, &[101]);
    let reducing = event(2, 5, 2, 100, &[102, 103]);
    assert!(pending.push(small.clone(), true));
    assert!(pending.push(reducing.clone(), true));
    assert_eq!(pending.recovery_batch()[0].id_hex(), small.id);
    assert_eq!(pending.recovery_batch()[0].id_hex(), reducing.id);
    assert_eq!(pending.recovery_batch()[0].id_hex(), small.id);
    assert_eq!(pending.len(), 2, "failed attempts keep both leases");
}
