#![allow(clippy::expect_used, clippy::panic)]
use super::*;
use crate::store::Store;

fn id(n: usize) -> String {
    format!("{n:064x}")
}
fn owners(names: &[&str]) -> BTreeSet<String> {
    names.iter().map(|name| (*name).to_owned()).collect()
}
fn wanted(
    ids: impl IntoIterator<Item = String>,
    names: &[&str],
) -> BTreeMap<String, BTreeSet<String>> {
    ids.into_iter().map(|id| (id, owners(names))).collect()
}
#[test]
fn total_entries_parallel_jobs_and_each_batch_are_bounded() {
    let held = Store::new(10);
    let empty = BTreeSet::new();
    let mut state = State {
        enabled: true,
        ..Default::default()
    };
    state.synchronize(
        wanted((1..=3000).map(id), &["one"]),
        &held,
        &empty,
        &empty,
        0,
    );
    assert_eq!(state.entries.len(), TRACKED_IDS);
    let jobs = state.drain(0);
    assert_eq!(jobs.len(), MAX_JOBS);
    assert!(jobs.iter().all(|job| job.ids.len() == BATCH_IDS));
    assert_eq!(state.jobs.len(), MAX_JOBS);
    assert!(state.drain(1).is_empty());
}
#[test]
fn held_network_or_queued_ids_never_start_an_identical_disk_job() {
    let held = Store::new(10);
    let mut state = State {
        enabled: true,
        ..Default::default()
    };
    let network = owners(&[&id(6)]);
    let queued = owners(&[&id(7)]);
    let wants = wanted([id(6), id(7), id(8)], &["one"]);
    state.synchronize(wants, &held, &queued, &network, 0);
    let jobs = state.drain(0);
    assert_eq!(jobs.len(), 1);
    assert_eq!(jobs[0].ids, [id(8)]);
    assert!(state.pending(&id(7), 0));
    assert!(!state.pending(&id(6), 0));
}
#[test]
fn timed_out_and_negative_ids_recover_after_cooldown_even_if_owner_is_still_open() {
    let held = Store::new(10);
    let empty = BTreeSet::new();
    let mut state = State {
        enabled: true,
        ..Default::default()
    };
    let wants = wanted([id(9)], &["one"]);
    state.synchronize(wants.clone(), &held, &empty, &empty, 0);
    let old = state.drain(0)[0].job;
    assert!(state.live(old, DEADLINE_MS - 1));
    assert!(!state.live(old, DEADLINE_MS));
    assert!(state.reconcile(&held, &empty, &empty, DEADLINE_MS));
    state.synchronize(
        wants.clone(),
        &held,
        &empty,
        &empty,
        DEADLINE_MS + MISS_MS - 1,
    );
    assert!(state.drain(DEADLINE_MS + MISS_MS - 1).is_empty());
    assert!(state.reconcile(&held, &empty, &empty, DEADLINE_MS + MISS_MS));
    state.synchronize(wants, &held, &empty, &empty, DEADLINE_MS + MISS_MS);
    let new = state.drain(DEADLINE_MS + MISS_MS);
    assert_eq!(new.len(), 1);
    assert_ne!(new[0].job, old);
}
