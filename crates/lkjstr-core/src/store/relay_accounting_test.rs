#![allow(clippy::expect_used)]
use super::{AtomRef, Inserted, MAX_SEEN_RELAYS, Store};
use lkjstr_protocol::NostrEvent;
use std::mem::size_of;
fn event(id: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: "a".repeat(64),
        created_at: id,
        kind,
        content: String::new(),
        tags: vec![],
        sig: "b".repeat(128),
    }
}
fn census(store: &Store) {
    let expected: usize = store
        .seen_on
        .values()
        .map(|seen| seen.capacity() * size_of::<AtomRef>())
        .sum();
    assert_eq!(store.seen_on_bytes, expected);
}
#[test]
fn relay_vector_charge_matches_full_census_through_duplicates_caps_and_leases() {
    let mut store = Store::with_caps(2, 2);
    let first = event(1, 1);
    census(&store);
    assert_eq!(store.seen_on_bytes, 0);
    store.insert(first.clone(), Some("wss://first.invalid/"));
    census(&store);
    let initial = store.seen_on_bytes;
    assert_eq!(
        store.insert(first.clone(), Some("wss://first.invalid/")),
        Inserted::Duplicate
    );
    assert_eq!(store.seen_on_bytes, initial);
    census(&store);
    for n in 1..MAX_SEEN_RELAYS {
        store.insert(first.clone(), Some(&format!("wss://relay-{n}.invalid/")));
        census(&store);
    }
    let capped = store.seen_on_bytes;
    for n in MAX_SEEN_RELAYS..MAX_SEEN_RELAYS + 3 {
        store.insert(first.clone(), Some(&format!("wss://relay-{n}.invalid/")));
        census(&store);
        assert_eq!(store.seen_on_bytes, capped);
        assert_eq!(store.seen_on(&first.id).len(), MAX_SEEN_RELAYS);
    }
    let lease = store.lease(&first.id).expect("persistence lease");
    let second = event(2, 1);
    let third = event(3, 1);
    store.insert(second.clone(), Some("wss://second.invalid/"));
    census(&store);
    store.insert(third.clone(), Some("wss://third.invalid/"));
    census(&store);
    assert!(
        store.lease(&first.id).is_none(),
        "count cap evicts the oldest"
    );
    assert!(store.seen_on(&first.id).is_empty());
    assert!(
        lease.matches(&first),
        "payload lease outlives relay vectors"
    );
    store.remove(&second.id);
    census(&store);
    let remaining = store.seen_on_bytes;
    store.remove(&second.id);
    assert_eq!(
        store.seen_on_bytes, remaining,
        "missing removal cannot subtract twice"
    );
    census(&store);
    store.remove(&third.id);
    census(&store);
    assert_eq!(store.seen_on_bytes, 0);
    drop(lease);
    store.compact.reap();
    census(&store);
}
#[test]
fn replacement_and_deletion_release_vectors_without_releasing_external_payloads() {
    let mut store = Store::new(8);
    let old = event(1, 0);
    let new = event(2, 0);
    store.insert(old.clone(), Some("wss://old.invalid/"));
    let old_lease = store.lease(&old.id).expect("old profile lease");
    assert_eq!(
        store.insert(new.clone(), Some("wss://new.invalid/")),
        Inserted::Replaced
    );
    census(&store);
    assert!(store.seen_on(&old.id).is_empty());
    let bytes = store.seen_on_bytes;
    assert_eq!(
        store.insert(old.clone(), Some("wss://stale.invalid/")),
        Inserted::Stale
    );
    assert_eq!(store.seen_on_bytes, bytes);
    census(&store);
    let mut deletion = event(3, 5);
    deletion.tags = vec![vec!["e".into(), new.id.clone()]];
    store.insert(deletion, None);
    census(&store);
    assert!(store.seen_on(&new.id).is_empty());
    assert_eq!(store.seen_on_bytes, 0);
    assert!(old_lease.matches(&old));
}
