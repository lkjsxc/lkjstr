use crate::home_feed_cache::follow_pubkeys_from_latest;
use lkjstr_storage::{
    StorageOperation, StorageOutcome, StorageProblem, StorageProblemKind, StoredEventRecord,
};
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn unavailable_follow_cache_returns_loading_signal_with_diagnostic() {
    let mut diagnostics = Vec::new();
    let outcome: StorageOutcome<Option<StoredEventRecord>> = StorageOutcome::Busy(
        StorageProblem::with_kind(
            StorageOperation::Read,
            "events",
            StorageProblemKind::Busy,
            "follow-cache-test",
        ),
    );

    let follow_pubkeys = follow_pubkeys_from_latest(outcome, &mut diagnostics);

    assert_eq!(follow_pubkeys, None);
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(diagnostics[0].id, "follow-list-cache");
    assert!(diagnostics[0]
        .message
        .contains("Follow list cache unavailable: busy"));
}
