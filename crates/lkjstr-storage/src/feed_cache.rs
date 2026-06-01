#![doc = "Feed cache row codecs for SQLite storage."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FeedCursorRecord {
    pub cursor_id: String,
    pub feed_key: String,
    pub relay_set_key: String,
    pub direction: String,
    pub cursor_json: String,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FeedCoverageRecord {
    pub coverage_id: String,
    pub feed_key: String,
    pub relay_url: String,
    pub filter_fingerprint: String,
    pub since_exclusive: Option<u64>,
    pub until_exclusive: Option<u64>,
    pub completed_at_ms: u64,
    pub event_count: u64,
    pub dense: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteFeedCoverageRow {
    pub coverage_id: String,
    pub feed_key: String,
    pub relay_url: String,
    pub filter_fingerprint: String,
    pub since_exclusive: Option<u64>,
    pub until_exclusive: Option<u64>,
    pub completed_at_ms: u64,
    pub event_count: u64,
    pub dense: i64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FeedScanHintRecord {
    pub hint_id: String,
    pub feed_key: String,
    pub relay_url: String,
    pub filter_fingerprint: String,
    pub span_seconds: u64,
    pub updated_at_ms: u64,
    pub expires_at_ms: u64,
}

pub type SqliteFeedCursorRow = FeedCursorRecord;
pub type SqliteFeedScanHintRow = FeedScanHintRecord;

#[must_use]
pub fn sqlite_feed_cursor_row(row: &FeedCursorRecord) -> SqliteFeedCursorRow {
    row.clone()
}

#[must_use]
pub fn sqlite_feed_coverage_row(row: &FeedCoverageRecord) -> SqliteFeedCoverageRow {
    SqliteFeedCoverageRow {
        coverage_id: row.coverage_id.clone(),
        feed_key: row.feed_key.clone(),
        relay_url: row.relay_url.clone(),
        filter_fingerprint: row.filter_fingerprint.clone(),
        since_exclusive: row.since_exclusive,
        until_exclusive: row.until_exclusive,
        completed_at_ms: row.completed_at_ms,
        event_count: row.event_count,
        dense: i64::from(row.dense),
    }
}

#[must_use]
pub fn feed_coverage_from_sqlite_row(row: &SqliteFeedCoverageRow) -> FeedCoverageRecord {
    FeedCoverageRecord {
        coverage_id: row.coverage_id.clone(),
        feed_key: row.feed_key.clone(),
        relay_url: row.relay_url.clone(),
        filter_fingerprint: row.filter_fingerprint.clone(),
        since_exclusive: row.since_exclusive,
        until_exclusive: row.until_exclusive,
        completed_at_ms: row.completed_at_ms,
        event_count: row.event_count,
        dense: row.dense != 0,
    }
}

#[must_use]
pub fn sqlite_feed_scan_hint_row(row: &FeedScanHintRecord) -> SqliteFeedScanHintRow {
    row.clone()
}
