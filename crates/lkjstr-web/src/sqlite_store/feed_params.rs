#![doc = "SQLite feed-cache parameter helpers."]

use lkjstr_storage::{FeedCursorRecord, FeedScanHintRecord, SqliteFeedCoverageRow};

use crate::{
    sqlite_store::params::{integer, opt_integer, params, raw_integer, text},
    storage_worker::SqlParams,
};

pub fn cursor_params(row: FeedCursorRecord) -> Option<SqlParams> {
    params(vec![
        text(row.cursor_id),
        text(row.feed_key),
        text(row.relay_set_key),
        text(row.direction),
        text(row.cursor_json),
        integer(row.updated_at_ms),
    ])
}

pub fn coverage_params(row: SqliteFeedCoverageRow) -> Option<SqlParams> {
    params(vec![
        text(row.coverage_id),
        text(row.feed_key),
        text(row.relay_url),
        text(row.filter_fingerprint),
        opt_integer(row.since_exclusive),
        opt_integer(row.until_exclusive),
        integer(row.completed_at_ms),
        integer(row.event_count),
        raw_integer(row.dense),
    ])
}

pub fn scan_hint_params(row: FeedScanHintRecord) -> Option<SqlParams> {
    params(vec![
        text(row.hint_id),
        text(row.feed_key),
        text(row.relay_url),
        text(row.filter_fingerprint),
        integer(row.span_seconds),
        integer(row.updated_at_ms),
        integer(row.expires_at_ms),
    ])
}
