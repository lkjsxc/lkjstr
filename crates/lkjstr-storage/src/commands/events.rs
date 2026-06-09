#![doc = "Event-cache storage command metadata."]

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
const CACHE: &[Class] = &[Class::RecoverableCache];
const CACHE_AND_LEDGER: &[Class] = &[Class::RecoverableCache, Class::Ledger];

#[allow(clippy::too_many_arguments)]
const fn event_cache(
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
        family: Family::EventCache,
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
pub const EVENT_PUT_COMMAND: Spec = event_cache("event-cache.event.put", Op::Transaction, "EventPutInput", "EventPutOutput", &["events.upsert", "event_tags.delete_by_event", "event_tags.upsert", "event_relays.upsert", "cache_ledger.upsert"], &["events", "event_tags", "event_relays", "cache_ledger"], &["sqlite_event_row", "sqlite_event_tag_rows", "sqlite_event_relay_row", "sqlite_cache_ledger_row"], CACHE_WRITE, CACHE_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Stats::CacheSummary);
#[rustfmt::skip]
pub const EVENT_GET_COMMAND: Spec = event_cache("event-cache.event.get", Op::Read, "EventGetInput", "EventGetOutput", &["events.select"], &["events"], &["event_from_sqlite_row"], CACHE_READ, CACHE, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const EVENT_RELAYS_COMMAND: Spec = event_cache("event-cache.event-relays", Op::Read, "EventRelaysInput", "EventRelaysOutput", &["event_relays.by_event"], &["event_relays"], &["sqlite_event_relay_row"], CACHE_READ, CACHE, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const EVENTS_BY_TAG_VALUE_COMMAND: Spec = event_cache("event-cache.events-by-tag-value", Op::Read, "EventsByTagValueInput", "EventsByTagValueOutput", &["events.by_tag_value"], &["events", "event_tags"], &["event_from_sqlite_row"], CACHE_READ, CACHE, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const EVENTS_BY_KIND_COMMAND: Spec = event_cache("event-cache.events-by-kind", Op::Read, "EventsByKindInput", "EventsByKindOutput", &["events.by_kind_time"], &["events"], &["event_from_sqlite_row"], CACHE_READ, CACHE, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const EVENTS_BY_AUTHOR_KIND_COMMAND: Spec = event_cache("event-cache.events-by-author-kind", Op::Read, "EventsByAuthorKindInput", "EventsByAuthorKindOutput", &["events.by_pubkey_kind_time"], &["events"], &["event_from_sqlite_row"], CACHE_READ, CACHE, Ledger::None, Stats::None);

pub const EVENT_CACHE_COMMANDS: &[Spec] = &[
    EVENT_PUT_COMMAND,
    EVENT_GET_COMMAND,
    EVENT_RELAYS_COMMAND,
    EVENTS_BY_TAG_VALUE_COMMAND,
    EVENTS_BY_KIND_COMMAND,
    EVENTS_BY_AUTHOR_KIND_COMMAND,
];
