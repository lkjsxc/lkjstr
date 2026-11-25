#![allow(clippy::expect_used)]
use super::Pool;
use lkjstr_protocol::NostrEvent;
use std::sync::Arc;
fn event(id: usize) -> NostrEvent {
    NostrEvent {
        id: format!("{id:064x}"),
        pubkey: "1".repeat(64),
        created_at: id as u64,
        kind: 1,
        tags: vec![],
        content: String::new(),
        sig: "0".repeat(128),
    }
}
#[test]
fn periodic_sweeps_skip_append_only_load_and_wait_for_the_final_payload_lease() {
    let mut pool = Pool::default();
    let empty = pool.managed_bytes();
    let mut first = event(0);
    first.tags = vec![vec!["t".into(), "release-marker".into()]];
    let first = pool.pack(first).expect("fixture");
    let mut held = vec![Arc::clone(&first)];
    for i in 1..256 {
        held.push(pool.pack(event(i)).expect("fixture"));
    }
    assert_eq!(pool.maintenance_counts(), (0, 3));
    // Removing an index reference is not a payload release while persistence
    // still owns the lease. This interval must also avoid the useless sweep.
    drop(held.remove(0));
    for i in 256..512 {
        held.push(pool.pack(event(i)).expect("fixture"));
    }
    assert_eq!(pool.maintenance_counts(), (0, 3));
    drop(first);
    for i in 512..768 {
        held.push(pool.pack(event(i)).expect("fixture"));
    }
    assert_eq!(pool.maintenance_counts(), (1, 1));
    drop(held);
    pool.reap();
    assert_eq!(pool.maintenance_counts(), (2, 0));
    assert_eq!(pool.managed_bytes(), empty);
    // Pressure-triggered sweeps remain unconditional even without new releases.
    pool.reap();
    assert_eq!(pool.maintenance_counts(), (3, 0));
}
#[test]
fn borrowed_tag_ids_preserve_duplicates_and_reject_noncanonical_values() {
    let mut pool = Pool::default();
    let mut source = event(0);
    source.tags = vec![
        vec!["p".into(), "1".repeat(64)],
        vec!["p".into(), "1".repeat(64)],
        vec!["p".into(), "A".repeat(64)],
        vec!["p".into(), String::new()],
        vec!["p".into()],
        vec!["p".into(), "not-an-id".into()],
        vec!["e".into(), "2".repeat(64)],
        vec!["q".into(), "3".repeat(64)],
        vec!["P".into(), "4".repeat(64)],
    ];
    let packed = pool.pack(source).expect("fixture");
    let ids = packed.tag_ids("p").collect::<Vec<_>>();
    assert_eq!(ids, vec![&[0x11; 32], &[0x11; 32]]);
    assert!(std::ptr::eq(ids[0], packed.pubkey()));
    assert_eq!(
        packed.tag_ids("e").copied().collect::<Vec<_>>(),
        [[0x22; 32]]
    );
    assert_eq!(
        packed.tag_ids("q").copied().collect::<Vec<_>>(),
        [[0x33; 32]]
    );
    assert_eq!(packed.tag_ids("absent").count(), 0);
}
