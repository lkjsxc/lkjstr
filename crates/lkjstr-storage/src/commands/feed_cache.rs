#![doc = "Feed evidence storage command metadata."]

use crate::{
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
};

const CACHE_READ: &[Problem] = &[Problem::CacheRecordDecodeFailed];
const CACHE_WRITE: &[Problem] = &[
    Problem::CacheRecordDecodeFailed,
    Problem::QuotaOrWriteFailed,
];
const FEED: &[Class] = &[Class::DerivedFeedCache];
const FEED_AND_LEDGER: &[Class] = &[Class::DerivedFeedCache, Class::Ledger];

#[allow(clippy::too_many_arguments)]
const fn feed(
    id: &'static str,
    operation: Op,
    input_type: &'static str,
    output_type: &'static str,
    statements: &'static [&'static str],
    tables: &'static [&'static str],
    row_codecs: &'static [&'static str],
    problem_kinds: &'static [Problem],
    data_classes: &'static [Class],
    ledger_policy: Ledger,
    stats_projection: Stats,
) -> Spec {
    Spec {
        id,
        family: Family::FeedEvidence,
        operation,
        input_type,
        output_type,
        statements,
        tables,
        row_codecs,
        problem_kinds,
        data_classes,
        ledger_policy,
        protection_policy: Protection::RecoverableCache,
        stats_projection,
    }
}

#[rustfmt::skip]
pub const FEED_CURSOR_PUT_COMMAND: Spec = feed("feed-evidence.cursor.put", Op::Transaction, "FeedCursorPutInput", "FeedCursorPutOutput", &["feed_cursors.upsert", "cache_ledger.upsert"], &["feed_cursors", "cache_ledger"], &["sqlite_feed_cursor_row", "sqlite_cache_ledger_row"], CACHE_WRITE, FEED_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Stats::CacheSummary);
#[rustfmt::skip]
pub const FEED_CURSOR_GET_COMMAND: Spec = feed("feed-evidence.cursor.get", Op::Read, "FeedCursorGetInput", "FeedCursorGetOutput", &["feed_cursors.select"], &["feed_cursors"], &["sqlite_feed_cursor_row"], CACHE_READ, FEED, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const FEED_COVERAGE_PUT_COMMAND: Spec = feed("feed-evidence.coverage.put", Op::Transaction, "FeedCoveragePutInput", "FeedCoveragePutOutput", &["feed_coverage.upsert", "cache_ledger.upsert"], &["feed_coverage", "cache_ledger"], &["sqlite_feed_coverage_row", "sqlite_cache_ledger_row"], CACHE_WRITE, FEED_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Stats::CacheSummary);
#[rustfmt::skip]
pub const FEED_COVERAGE_FOR_FEED_COMMAND: Spec = feed("feed-evidence.coverage.for-feed", Op::Read, "FeedCoverageForFeedInput", "FeedCoverageForFeedOutput", &["feed_coverage.by_feed"], &["feed_coverage"], &["feed_coverage_from_sqlite_row"], CACHE_READ, FEED, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const FEED_SCAN_HINT_PUT_COMMAND: Spec = feed("feed-evidence.scan-hint.put", Op::Transaction, "FeedScanHintPutInput", "FeedScanHintPutOutput", &["feed_scan_hints.upsert", "cache_ledger.upsert"], &["feed_scan_hints", "cache_ledger"], &["sqlite_feed_scan_hint_row", "sqlite_cache_ledger_row"], CACHE_WRITE, FEED_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Stats::CacheSummary);
#[rustfmt::skip]
pub const FEED_SCAN_HINTS_FOR_FEED_COMMAND: Spec = feed("feed-evidence.scan-hints.for-feed", Op::Read, "FeedScanHintsForFeedInput", "FeedScanHintsForFeedOutput", &["feed_scan_hints.by_feed"], &["feed_scan_hints"], &["sqlite_feed_scan_hint_row"], CACHE_READ, FEED, Ledger::None, Stats::None);

pub const FEED_EVIDENCE_COMMANDS: &[Spec] = &[
    FEED_CURSOR_PUT_COMMAND,
    FEED_CURSOR_GET_COMMAND,
    FEED_COVERAGE_PUT_COMMAND,
    FEED_COVERAGE_FOR_FEED_COMMAND,
    FEED_SCAN_HINT_PUT_COMMAND,
    FEED_SCAN_HINTS_FOR_FEED_COMMAND,
];
