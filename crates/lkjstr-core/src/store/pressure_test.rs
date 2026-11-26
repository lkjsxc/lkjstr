#![allow(clippy::expect_used)]
use super::*;
use crate::{
    cache::{
        Record,
        durable::{Access, Hint, Observation, Scan, State},
    },
    optimizer::{
        keep_policy::KeepScorer,
        retention::{Candidate, Candidates, Target},
    },
};
use lkjstr_protocol::NostrEvent;

fn event(id: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: format!("{:064x}", 1),
        created_at: 1,
        kind,
        tags: vec![],
        content: "same".into(),
        sig: "0".repeat(128),
    }
}
#[test]
fn authored_priority_oracle_covers_classes_weights_and_exact_id_ties() {
    let scorer = KeepScorer::default();
    let mut choices = Candidates::default();
    for (id, kind, weight, expected) in [
        (1, 7, 1, 75_000),
        (2, 1, 1, 225_000),
        (3, 0, 1, 675_000),
        (4, 1, 32, 810_000),
        (5, 1, 1, 225_000),
    ] {
        let score = scorer.score(0, kind, weight, 0, 1500, 500);
        assert_eq!(score, expected);
        choices.push(Candidate {
            score,
            id: format!("{id:064x}"),
            replaceable: false,
            generation: 1,
            bytes: 500,
        });
    }
    let mut actual = Vec::new();
    while let Some(candidate) = choices.pop() {
        actual.push(candidate.id);
    }
    assert_eq!(actual, [1, 2, 5, 3, 4].map(|id| format!("{id:064x}")));
}
#[test]
fn resident_and_durable_adapters_evict_the_same_authored_class_order() {
    let rows: Vec<_> = [(1, 7), (2, 1), (3, 6), (4, 1)]
        .into_iter()
        .map(|(id, kind)| event(id, kind))
        .collect();
    let mut store = Store::with_caps(3, 3).weight_retention();
    for row in &rows {
        store.insert_deferred(row.clone(), None);
    }
    store.trim_weighted(
        &BTreeSet::new(),
        &BTreeSet::new(),
        &BTreeMap::new(),
        &BTreeMap::new(),
        LinkState::default(),
    );
    let resident: Vec<_> = rows
        .iter()
        .filter(|row| store.lease(&row.id).is_none())
        .map(|row| row.id.clone())
        .collect();
    let state = State {
        epoch: Some((
            0,
            0,
            Target {
                regular: 2,
                replaceable: 3,
                total: 6,
                bytes: usize::MAX,
            },
        )),
        ..Default::default()
    };
    let mut disk = Scan::new(state, Access::default(), &[]);
    for event in rows {
        disk.push(
            &Record::verified(&event).expect("record"),
            Hint {
                observation: Observation {
                    minute: 0,
                    weight: 1,
                    refetch: 1500,
                },
                inflation: 0,
            },
        );
    }
    let durable: Vec<_> = disk
        .victims(256, &BTreeSet::new())
        .into_iter()
        .map(|row| row.id)
        .collect();
    let expected = [format!("{:064x}", 1), format!("{:064x}", 3)];
    assert_eq!(resident, expected);
    assert_eq!(durable, expected);
}
#[test]
fn pressure_scans_resume_and_revalidate_new_holds_before_removal() {
    let mut store = Store::with_caps(500, 500).weight_retention();
    for id in 1..=600 {
        store.insert_deferred(event(id, 1), None);
    }
    let own = BTreeSet::new();
    let mut held = BTreeSet::new();
    let weights = BTreeMap::new();
    let first = BTreeMap::new();
    store.trim_weighted(&own, &held, &weights, &first, LinkState::default());
    assert_eq!(
        store.len(),
        600,
        "first 256-row scan has no complete ordering yet"
    );
    assert!(store.pressure_active());
    assert!(store.pressure_admission_paused());
    assert!(store.pressure_scratch_bytes() < 256 * 1024);
    held.insert(format!("{:064x}", 1));
    for _ in 0..8 {
        store.trim_weighted(&own, &held, &weights, &first, LinkState::default());
    }
    assert_eq!(store.len(), 475);
    assert!(store.lease(&format!("{:064x}", 1)).is_some());
    assert!(store.lease(&format!("{:064x}", 2)).is_none());
    assert!(!store.pressure_active());
    assert!(!store.pressure_admission_paused());
    assert_eq!(store.pressure_scratch_bytes(), 0);
}
#[test]
fn unknown_deletion_witnesses_remain_pinned_after_the_tombstone_index_fills() {
    let mut store = Store::with_caps(4097, 10).weight_retention();
    for id in 1..=4097 {
        let mut proof = event(id, 5);
        proof.tags = vec![vec!["e".into(), format!("{:064x}", id + 10_000)]];
        store.insert_deferred(proof, None);
    }
    store.insert_deferred(event(5000, 1), None);
    for _ in 0..40 {
        store.trim_weighted(
            &BTreeSet::new(),
            &BTreeSet::new(),
            &BTreeMap::new(),
            &BTreeMap::new(),
            LinkState::default(),
        );
    }
    assert!(store.lease(&format!("{:064x}", 4097)).is_some());
    assert_eq!(
        store.insert_deferred(event(14097, 1), None),
        super::super::Inserted::Deleted
    );
}
