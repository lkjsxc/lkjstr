use lkjstr_relays::RelayCloseTombstones;

#[test]
fn tombstones_match_until_ttl_expires() {
    let mut tombstones = RelayCloseTombstones::new(10, 16);

    tombstones.record(["sub-a", "sub-b"], 100);

    assert!(tombstones.has_any(["missing", "sub-a"], 105));
    assert!(!tombstones.has_any(["sub-a"], 110));
}

#[test]
fn tombstones_prune_oldest_entries_when_size_exceeds_cap() {
    let mut tombstones = RelayCloseTombstones::new(10_000, 2);

    tombstones.record(["a"], 0);
    tombstones.record(["b"], 1);
    tombstones.record(["c"], 2);

    assert_eq!(tombstones.len(), 2);
    assert!(!tombstones.has_any(["a"], 3));
    assert!(tombstones.has_any(["b", "c"], 3));
}
