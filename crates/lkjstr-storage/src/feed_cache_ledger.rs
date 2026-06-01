#![doc = "Feed cache ledger records for SQLite storage."]

use serde::Serialize;

use crate::{
    CacheLedgerRecord, FeedCoverageRecord, FeedCursorRecord, FeedScanHintRecord,
    resource::{CacheOwnerKind, CacheResourceKind},
    tab_state::{cache_ledger_id, encoded_json_bytes},
};

pub fn feed_cursor_ledger_record(
    row: &FeedCursorRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    ledger(row, CacheOwnerKind::FeedPage, CacheResourceKind::FeedCursor)
}

pub fn feed_coverage_ledger_record(
    row: &FeedCoverageRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    ledger(
        row,
        CacheOwnerKind::FeedCoverage,
        CacheResourceKind::CoverageRow,
    )
}

pub fn feed_scan_hint_ledger_record(
    row: &FeedScanHintRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    ledger(
        row,
        CacheOwnerKind::FeedScanHint,
        CacheResourceKind::ScanHint,
    )
}

fn ledger(
    row: &impl FeedLedgerRow,
    owner_kind: CacheOwnerKind,
    resource_kind: CacheResourceKind,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    Ok(CacheLedgerRecord {
        id: cache_ledger_id(owner_kind, row.resource_id()),
        owner_kind,
        resource_kind,
        resource_id: row.resource_id().to_owned(),
        score: row.score(),
        created_at: row.updated_at_ms(),
        updated_at: row.updated_at_ms(),
        cache_bytes: encoded_json_bytes(row)?,
        protected: false,
        account_pubkey: None,
        feed_key: Some(row.feed_key().to_owned()),
        relay_url: row.relay_url().map(ToOwned::to_owned),
        reason: Some(row.reason().to_owned()),
    })
}

trait FeedLedgerRow: Serialize {
    fn resource_id(&self) -> &str;
    fn feed_key(&self) -> &str;
    fn updated_at_ms(&self) -> u64;
    fn score(&self) -> i64;
    fn reason(&self) -> &str;
    fn relay_url(&self) -> Option<&str>;
}

impl FeedLedgerRow for FeedCursorRecord {
    fn resource_id(&self) -> &str {
        &self.cursor_id
    }
    fn feed_key(&self) -> &str {
        &self.feed_key
    }
    fn updated_at_ms(&self) -> u64 {
        self.updated_at_ms
    }
    fn score(&self) -> i64 {
        20
    }
    fn reason(&self) -> &str {
        "feed-cursor"
    }
    fn relay_url(&self) -> Option<&str> {
        None
    }
}

impl FeedLedgerRow for FeedCoverageRecord {
    fn resource_id(&self) -> &str {
        &self.coverage_id
    }
    fn feed_key(&self) -> &str {
        &self.feed_key
    }
    fn updated_at_ms(&self) -> u64 {
        self.completed_at_ms
    }
    fn score(&self) -> i64 {
        if self.dense { 5 } else { 15 }
    }
    fn reason(&self) -> &str {
        "feed-coverage"
    }
    fn relay_url(&self) -> Option<&str> {
        Some(&self.relay_url)
    }
}

impl FeedLedgerRow for FeedScanHintRecord {
    fn resource_id(&self) -> &str {
        &self.hint_id
    }
    fn feed_key(&self) -> &str {
        &self.feed_key
    }
    fn updated_at_ms(&self) -> u64 {
        self.updated_at_ms
    }
    fn score(&self) -> i64 {
        10
    }
    fn reason(&self) -> &str {
        "feed-scan-hint"
    }
    fn relay_url(&self) -> Option<&str> {
        Some(&self.relay_url)
    }
}
