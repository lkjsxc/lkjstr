#![allow(clippy::expect_used)]
use lkjstr_core::{
    cache::{
        Record,
        durable::{Access, Hint, Scan, State},
    },
    optimizer::retention::{Target, Usage},
};
use lkjstr_protocol::NostrEvent;
use std::collections::BTreeSet;

fn event(id: u64, kind: u64, at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: format!("{:064x}", 1),
        created_at: at,
        kind,
        content: "body".into(),
        tags,
        sig: "0".repeat(128),
    }
}
fn record(event: &NostrEvent) -> Record {
    Record::verified(event).expect("verified fixture")
}
fn state(total: usize) -> State {
    State {
        epoch: Some((
            100,
            0,
            Target {
                regular: total,
                replaceable: total,
                total,
                bytes: usize::MAX,
            },
        )),
        ..Default::default()
    }
}
#[test]
fn only_the_newest_own_revision_is_protected_and_deletion_overrides_holds() {
    let old = event(1, 0, 1, vec![]);
    let latest = event(2, 0, 2, vec![]);
    let access = Access {
        own: BTreeSet::from([old.pubkey.clone()]),
        held: BTreeSet::from([old.id.clone()]),
        ..Default::default()
    };
    let mut scan = Scan::new(state(1), access.clone(), &[record(&latest)]);
    for event in [&latest, &old] {
        scan.push(&record(event), Hint::default());
    }
    assert_eq!(
        scan.victims(256, &access.held)
            .into_iter()
            .map(|row| row.id)
            .collect::<Vec<_>>(),
        vec![old.id.clone()]
    );
    let proof = event(3, 5, 3, vec![vec!["e".into(), latest.id.clone()]]);
    let access = Access {
        held: BTreeSet::from([latest.id.clone()]),
        ..access
    };
    let mut scan = Scan::new(state(1), access.clone(), &[record(&proof)]);
    for event in [&latest, &proof] {
        scan.push(&record(event), Hint::default());
    }
    assert_eq!(
        scan.victims(256, &access.held)
            .into_iter()
            .map(|row| row.id)
            .collect::<Vec<_>>(),
        vec![latest.id.clone()]
    );
}
#[test]
fn nip01_tie_order_and_address_cutoff_are_independent_of_scan_order() {
    let tags = vec![vec!["d".into(), "name".into()]];
    let winner = event(1, 30030, 2, tags.clone());
    let loser = event(2, 30030, 2, tags);
    let access = Access {
        own: BTreeSet::from([winner.pubkey.clone()]),
        ..Default::default()
    };
    for order in [[&winner, &loser], [&loser, &winner]] {
        let mut scan = Scan::new(state(1), access.clone(), &[]);
        for event in order {
            scan.push(&record(event), Hint::default());
        }
        assert_eq!(scan.victims(256, &BTreeSet::new())[0].id, loser.id);
    }
    let proof = event(
        3,
        5,
        2,
        vec![vec!["a".into(), format!("30030:{}:name", winner.pubkey)]],
    );
    let mut scan = Scan::new(state(1), access, &[record(&proof)]);
    for event in [&winner, &proof] {
        scan.push(&record(event), Hint::default());
    }
    assert_eq!(scan.victims(256, &BTreeSet::new())[0].id, winner.id);
}
#[test]
fn frozen_epoch_and_inflation_resume_with_the_same_remaining_victims() {
    let rows: Vec<_> = (1..=12)
        .map(|id| record(&event(id, 1, 1, vec![])))
        .collect();
    let mut first = Scan::new(state(4), Access::default(), &[]);
    for row in &rows {
        first.push(row, Hint::default());
    }
    let a = first.victims(3, &BTreeSet::new());
    assert_eq!(
        a.iter().map(|row| row.id.clone()).collect::<Vec<_>>(),
        (1..=3).map(|id| format!("{id:064x}")).collect::<Vec<_>>()
    );
    let encoded = serde_json::to_string(&first.state).expect("committed epoch");
    let resumed = State::read(Some(&encoded));
    assert!(resumed.epoch.is_some());
    let mut next = Scan::new(
        resumed,
        Access {
            minute: 999,
            ..Default::default()
        },
        &[],
    );
    for row in &rows[3..] {
        next.push(row, Hint::default());
    }
    let b = next.victims(256, &BTreeSet::new());
    assert_eq!(
        b.iter().map(|row| row.id.clone()).collect::<Vec<_>>(),
        (4..=8).map(|id| format!("{id:064x}")).collect::<Vec<_>>()
    );
    assert_eq!(next.used.total(), 4);
    assert!(next.state.epoch.is_none());
    assert!(next.state.inflation >= first.state.inflation);
}
#[test]
fn reinstalling_old_reference_bodies_triggers_pressure_from_conservative_debt() {
    let mut state = State {
        initialized: true,
        used: Usage {
            regular: 100,
            replaceable: 0,
            bytes: 60 * 1024 * 1024,
        },
        ..Default::default()
    };
    state.changed(1024 * 1024);
    assert!(!state.needed(101));
    state.changed(4 * 1024 * 1024);
    assert!(state.needed(106));
}

#[test]
fn disk_only_rows_receive_current_policy_and_explicit_mute_zero() {
    let muted = event(1, 1, 1, vec![]);
    let mut followed = event(2, 1, 1, vec![]);
    followed.pubkey = format!("{:064x}", 2);
    let mut neutral = event(3, 1, 1, vec![]);
    neutral.pubkey = format!("{:064x}", 3);
    let mut scan = Scan::new(state(1), Access::default(), &[]);
    for event in [&muted, &followed, &neutral] {
        scan.push(&record(event), Hint::default());
    }
    assert_eq!(scan.authors().len(), 3);
    scan.reweight(
        [
            (muted.pubkey.clone(), 0),
            (followed.pubkey.clone(), 32),
            (neutral.pubkey.clone(), 1),
        ]
        .into(),
    );
    let victims = scan.victims(256, &BTreeSet::new());
    assert_eq!(
        victims.iter().map(|row| row.id.clone()).collect::<Vec<_>>(),
        vec![muted.id, neutral.id]
    );
    assert_eq!(victims[0].score, 0);
}

#[test]
fn current_author_weight_cannot_promote_excluded_public_kinds() {
    let excluded = event(1, 10050, 1, vec![]);
    let public = event(2, 1, 1, vec![]);
    let mut scan = Scan::new(state(1), Access::default(), &[]);
    for event in [&excluded, &public] {
        scan.push(&record(event), Hint::default());
    }
    scan.reweight([(public.pubkey.clone(), 64)].into());
    let victims = scan.victims(256, &BTreeSet::new());
    assert_eq!(victims[0].id, excluded.id);
    assert_eq!(victims[0].score, 0);
}
