#![doc = "SQLite feed-cache repository calls."]

use lkjstr_storage::{
    FeedCoverageRecord, FeedCursorRecord, FeedScanHintRecord, SqliteFeedCoverageRow,
    SqliteFeedCursorRow, SqliteFeedScanHintRow, StorageOperation, StorageOutcome,
};

use crate::sqlite_store::{
    cache_ledger::ledger_step,
    database::SqliteStore,
    feed_params::{coverage_params, cursor_params, scan_hint_params},
    params::{integer, params, text},
    rows::{all_rows, first_row},
};

macro_rules! add_step {
    ($steps:expr, $outcome:expr $(,)?) => {
        match $outcome {
            StorageOutcome::Ok(step) => $steps.push(step),
            outcome => return outcome.map(|_| ()),
        }
    };
}

pub async fn sqlite_feed_cursor_put(
    store: &SqliteStore,
    row: &FeedCursorRecord,
) -> StorageOutcome<()> {
    let ledger = match lkjstr_storage::feed_cursor_ledger_record(row) {
        Ok(row) => row,
        Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
    };
    let mut steps = Vec::with_capacity(2);
    add_step!(
        &mut steps,
        store.step("feed_cursors.upsert", cursor_params(row.clone())),
    );
    add_step!(&mut steps, ledger_step(store, &ledger, "feed_cursors"));
    store.batch(steps).await
}

pub async fn sqlite_feed_cursor_get(
    store: &SqliteStore,
    cursor_id: &str,
) -> StorageOutcome<Option<FeedCursorRecord>> {
    let rows = match store
        .query("feed_cursors.select", params(vec![text(cursor_id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    first_row::<SqliteFeedCursorRow>(rows, "feed_cursors", "feed_cursors.select")
}

pub async fn sqlite_feed_coverage_put(
    store: &SqliteStore,
    rows: &[FeedCoverageRecord],
) -> StorageOutcome<()> {
    let mut steps = Vec::with_capacity(rows.len() * 2);
    for row in rows {
        let ledger = match lkjstr_storage::feed_coverage_ledger_record(row) {
            Ok(row) => row,
            Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
        };
        add_step!(
            &mut steps,
            store.step(
                "feed_coverage.upsert",
                coverage_params(lkjstr_storage::sqlite_feed_coverage_row(row)),
            ),
        );
        add_step!(&mut steps, ledger_step(store, &ledger, "feed_coverage"));
    }
    store.batch(steps).await
}

pub async fn sqlite_feed_coverage_for_feed(
    store: &SqliteStore,
    feed_key: &str,
) -> StorageOutcome<Vec<FeedCoverageRecord>> {
    let rows = match store
        .query("feed_coverage.by_feed", params(vec![text(feed_key)]), 2_000)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let sqlite_rows =
        match all_rows::<SqliteFeedCoverageRow>(rows, "feed_coverage", "feed_coverage.by_feed") {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| Vec::new()),
        };
    StorageOutcome::Ok(
        sqlite_rows
            .iter()
            .map(lkjstr_storage::feed_coverage_from_sqlite_row)
            .collect(),
    )
}

pub async fn sqlite_feed_scan_hint_put(
    store: &SqliteStore,
    row: &FeedScanHintRecord,
) -> StorageOutcome<()> {
    let ledger = match lkjstr_storage::feed_scan_hint_ledger_record(row) {
        Ok(row) => row,
        Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
    };
    let mut steps = Vec::with_capacity(2);
    add_step!(
        &mut steps,
        store.step("feed_scan_hints.upsert", scan_hint_params(row.clone())),
    );
    add_step!(&mut steps, ledger_step(store, &ledger, "feed_scan_hints"));
    store.batch(steps).await
}

pub async fn sqlite_feed_scan_hints_for_feed(
    store: &SqliteStore,
    feed_key: &str,
    now_ms: u64,
    limit: u64,
) -> StorageOutcome<Vec<FeedScanHintRecord>> {
    let rows = match store
        .query(
            "feed_scan_hints.by_feed",
            params(vec![text(feed_key), integer(now_ms), integer(limit)]),
            limit as u32,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows::<SqliteFeedScanHintRow>(rows, "feed_scan_hints", "feed_scan_hints.by_feed")
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "feed_cache",
        "corrupt",
        operation_id,
    ))
}
