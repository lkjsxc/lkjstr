#![doc = "Search storage command metadata."]

use crate::{
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    StoredEventRecord,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
    search::{SearchCursor, SqliteEventSearchTokenRow},
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TagLookupByValueInput {
    pub tag_name: String,
    pub tag_value: String,
    pub limit: u64,
}

pub type TagLookupByValueOutput = Vec<StoredEventRecord>;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchUpdateEventIndexInput {
    pub event_id: String,
    pub tokens: Vec<SqliteEventSearchTokenRow>,
}

pub type SearchUpdateEventIndexOutput = usize;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchLocalQueryInput {
    pub tokens: Vec<String>,
    pub limit: u64,
    pub before: Option<SearchCursor>,
}

pub type SearchLocalQueryOutput = Vec<StoredEventRecord>;

const CACHE_READ: &[Problem] = &[Problem::CacheRecordDecodeFailed];
const CACHE_WRITE: &[Problem] = &[
    Problem::CacheRecordDecodeFailed,
    Problem::QuotaOrWriteFailed,
];
const CACHE: &[Class] = &[Class::RecoverableCache];

#[allow(clippy::too_many_arguments)]
const fn search_command(
    id: &'static str,
    operation: Op,
    input_type: &'static str,
    output_type: &'static str,
    statements: &'static [&'static str],
    tables: &'static [&'static str],
    row_codecs: &'static [&'static str],
    problem_kinds: &'static [Problem],
) -> Spec {
    Spec {
        id,
        family: Family::SearchIndex,
        operation,
        input_type,
        output_type,
        statements,
        tables,
        row_codecs,
        problem_kinds,
        data_classes: CACHE,
        ledger_policy: Ledger::None,
        protection_policy: Protection::RecoverableCache,
        stats_projection: Stats::None,
    }
}

#[rustfmt::skip]
pub const TAG_LOOKUP_BY_VALUE_COMMAND: Spec = search_command("tag-lookup.by-value", Op::Read, "TagLookupByValueInput", "TagLookupByValueOutput", &["events.by_tag_value"], &["events", "event_tags"], &["event_from_sqlite_row"], CACHE_READ);
#[rustfmt::skip]
pub const SEARCH_UPDATE_EVENT_INDEX_COMMAND: Spec = search_command("search.update-event-index", Op::Transaction, "SearchUpdateEventIndexInput", "SearchUpdateEventIndexOutput", &["event_search_tokens.delete_by_event", "event_search_tokens.upsert"], &["event_search_tokens"], &["sqlite_event_search_token_rows"], CACHE_WRITE);
#[rustfmt::skip]
pub const SEARCH_LOCAL_QUERY_COMMAND: Spec = search_command("search.local-query", Op::Read, "SearchLocalQueryInput", "SearchLocalQueryOutput", &["event_search_tokens.by_token", "event_search_tokens.by_token_before", "events.select"], &["event_search_tokens", "events"], &["sqlite_event_search_token_row", "event_from_sqlite_row"], CACHE_READ);

pub const SEARCH_COMMANDS: &[Spec] = &[
    TAG_LOOKUP_BY_VALUE_COMMAND,
    SEARCH_UPDATE_EVENT_INDEX_COMMAND,
    SEARCH_LOCAL_QUERY_COMMAND,
];
