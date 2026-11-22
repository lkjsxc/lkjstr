use lkjstr_core::engine::avatars::{
    MAX_DERIVED_BYTES,
    cache::{self, Entry, Failure, Totals},
    host,
};
fn entry(index: usize, bytes: u64, used: u64) -> Entry {
    Entry {
        key: format!("https://avatar.test/{index}.webp"),
        bytes,
        used,
    }
}
fn totals(rows: &[Entry]) -> Totals {
    Totals {
        bytes: rows.iter().map(|row| row.bytes).sum(),
        entries: rows.len(),
        sequence: rows.iter().map(|row| row.used).max().unwrap_or(0),
    }
}
fn apply(rows: &mut Vec<Entry>, plan: &cache::Plan) {
    rows.retain(|row| !plan.remove.contains(&row.key) && row.key != plan.entry.key);
    rows.push(plan.entry.clone());
}
#[test]
fn exact_url_identity_keeps_query_and_fragment_distinctions() {
    assert_eq!(
        host("https://AVATAR.test:8443/a?q=1#x"),
        Some("avatar.test".into())
    );
    assert_eq!(host("http://avatar.test/a"), None);
    assert_eq!(host("https://reader:secret@avatar.test/a"), None);
    assert_eq!(host("https://avatar.test/\nfile"), None);
    let a = "https://avatar.test/a?q=1";
    let first = cache::insert(Totals::default(), &[], a, 100).expect("first");
    assert_eq!(first.entry.key, a);
    let next = cache::insert(
        first.totals,
        &[first.entry],
        "https://avatar.test/a?q=2",
        200,
    )
    .expect("next");
    assert!(!next.existing);
    assert_eq!(next.totals.bytes, 300);
}
#[test]
fn byte_pressure_evicts_the_oldest_untouched_url() {
    let count = (cache::MAX_BYTES / MAX_DERIVED_BYTES) as usize;
    let mut rows: Vec<_> = (0..count)
        .map(|n| entry(n, MAX_DERIVED_BYTES, n as u64 + 1))
        .collect();
    let (state, touched) = cache::touch(totals(&rows), &rows[0]).expect("touch");
    rows[0] = touched;
    let newest = entry(count, MAX_DERIVED_BYTES, 1);
    let plan = cache::insert(state, &rows, &newest.key, newest.bytes).expect("insert");
    assert_eq!(plan.remove, vec![rows[1].key.clone()]);
    assert_eq!(plan.totals.bytes, cache::MAX_BYTES);
    assert_eq!(plan.totals.entries, count);
    apply(&mut rows, &plan);
    assert!(rows.iter().any(|row| row.key == entry(0, 1, 1).key));
}
#[test]
fn entry_pressure_is_independent_of_byte_pressure() {
    let rows: Vec<_> = (0..cache::MAX_ENTRIES)
        .map(|n| entry(n, 1, n as u64 + 1))
        .collect();
    let plan = cache::insert(totals(&rows), &rows, "https://avatar.test/new", 1).expect("insert");
    assert_eq!(plan.remove, vec![rows[0].key.clone()]);
    assert_eq!(plan.totals.entries, cache::MAX_ENTRIES);
    assert_eq!(plan.totals.bytes, cache::MAX_ENTRIES as u64);
}
#[test]
fn concurrent_writer_reuses_the_committed_blob_instead_of_counting_it_twice() {
    let url = "https://avatar.test/same";
    let first = cache::insert(Totals::default(), &[], url, 500).expect("first transaction");
    // The second transaction reads the first commit, even if it encoded a different-sized Blob earlier.
    let second = cache::insert(first.totals, &[first.entry], url, 800).expect("second transaction");
    assert!(second.existing);
    assert!(second.remove.is_empty());
    assert_eq!(second.entry.bytes, 500);
    assert_eq!(second.totals.bytes, 500);
    assert_eq!(second.totals.entries, 1);
    assert_eq!(second.entry.used, 2);
}
#[test]
fn invalid_accounting_and_overflow_never_produce_a_retention_claim() {
    let rows = vec![entry(0, 100, 1)];
    let wrong = Totals {
        bytes: 99,
        ..totals(&rows)
    };
    assert_eq!(
        cache::insert(wrong, &rows, "https://avatar.test/new", 1),
        Err(Failure::Invalid)
    );
    assert_eq!(
        cache::insert(Totals::default(), &[], "https://avatar.test/new", u64::MAX),
        Err(Failure::TooLarge)
    );
    let exhausted = Totals {
        sequence: cache::MAX_SEQUENCE,
        ..totals(&rows)
    };
    assert_eq!(cache::touch(exhausted, &rows[0]), Err(Failure::Exhausted));
    let duplicate = vec![rows[0].clone(), rows[0].clone()];
    assert_eq!(
        cache::insert(totals(&duplicate), &duplicate, "https://avatar.test/new", 1),
        Err(Failure::Invalid)
    );
}
#[test]
fn one_thousand_mixed_size_faces_fit_without_evicting_current_entries() {
    let mut state = Totals::default();
    let mut rows = Vec::new();
    for n in 0..1000 {
        let row = entry(n, [4442, 4238, 12152][n % 3], 1);
        let plan = cache::insert(state, &rows, &row.key, row.bytes).expect("bounded insertion");
        assert!(plan.remove.is_empty());
        state = plan.totals;
        apply(&mut rows, &plan);
    }
    assert_eq!(rows.len(), 1000);
    assert!(state.bytes < cache::MAX_BYTES);
}
