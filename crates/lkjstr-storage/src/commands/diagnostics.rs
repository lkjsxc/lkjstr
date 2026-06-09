#![doc = "Relay diagnostics and notification command metadata."]

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
const PROTECTED_READ: &[Problem] = &[Problem::ProtectedRecordDecodeFailed];
const PROTECTED_WRITE: &[Problem] = &[
    Problem::ProtectedRecordDecodeFailed,
    Problem::QuotaOrWriteFailed,
];
const DIAG: &[Class] = &[Class::DiagnosticsCache];
const DIAG_AND_LEDGER: &[Class] = &[Class::DiagnosticsCache, Class::Ledger];
const CACHE_AND_LEDGER: &[Class] = &[Class::RecoverableCache, Class::Ledger];
const CACHE: &[Class] = &[Class::RecoverableCache];
const SAFETY: &[Class] = &[Class::ProtectedSafetyConfiguration];

#[allow(clippy::too_many_arguments)]
const fn diagnostics(
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
    protection_policy: Protection,
    stats_projection: Stats,
) -> Spec {
    Spec {
        id,
        family: Family::RelayDiagnostics,
        operation,
        input_type,
        output_type,
        statements,
        tables,
        row_codecs,
        problem_kinds,
        data_classes,
        ledger_policy,
        protection_policy,
        stats_projection,
    }
}

#[rustfmt::skip]
pub const RELAY_INFORMATION_PUT_COMMAND: Spec = diagnostics("relay-diagnostics.information.put", Op::Transaction, "RelayInformationPutInput", "RelayInformationPutOutput", &["relay_information.upsert", "cache_ledger.upsert"], &["relay_information", "cache_ledger"], &["sqlite_relay_information_row", "sqlite_cache_ledger_row"], CACHE_WRITE, DIAG_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_INFORMATION_GET_COMMAND: Spec = diagnostics("relay-diagnostics.information.get", Op::Read, "RelayInformationGetInput", "RelayInformationGetOutput", &["relay_information.select"], &["relay_information"], &["sqlite_relay_information_row"], CACHE_READ, DIAG, Ledger::None, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_INFORMATION_RECENT_COMMAND: Spec = diagnostics("relay-diagnostics.information.recent", Op::Read, "RelayInformationRecentInput", "RelayInformationRecentOutput", &["relay_information.recent"], &["relay_information"], &["sqlite_relay_information_row"], CACHE_READ, DIAG, Ledger::None, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_SUMMARY_PUT_COMMAND: Spec = diagnostics("relay-diagnostics.summary.put", Op::Transaction, "RelaySummaryPutInput", "RelaySummaryPutOutput", &["relay_diagnostic_summaries.upsert", "cache_ledger.upsert"], &["relay_diagnostic_summaries", "cache_ledger"], &["sqlite_relay_diagnostic_summary_row", "sqlite_cache_ledger_row"], CACHE_WRITE, DIAG_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_SUMMARY_GET_COMMAND: Spec = diagnostics("relay-diagnostics.summary.get", Op::Read, "RelaySummaryGetInput", "RelaySummaryGetOutput", &["relay_diagnostic_summaries.select"], &["relay_diagnostic_summaries"], &["sqlite_relay_diagnostic_summary_row"], CACHE_READ, DIAG, Ledger::None, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_SUMMARIES_RECENT_COMMAND: Spec = diagnostics("relay-diagnostics.summary.recent", Op::Read, "RelaySummariesRecentInput", "RelaySummariesRecentOutput", &["relay_diagnostic_summaries.recent"], &["relay_diagnostic_summaries"], &["sqlite_relay_diagnostic_summary_row"], CACHE_READ, DIAG, Ledger::None, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_SUGGESTIONS_PUT_COMMAND: Spec = diagnostics("relay-diagnostics.suggestions.put", Op::Transaction, "RelaySuggestionsPutInput", "RelaySuggestionsPutOutput", &["relay_list_suggestions.upsert", "cache_ledger.upsert"], &["relay_list_suggestions", "cache_ledger"], &["sqlite_relay_list_suggestion_row", "sqlite_cache_ledger_row"], CACHE_WRITE, DIAG_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const RELAY_SUGGESTIONS_FOR_PUBKEY_COMMAND: Spec = diagnostics("relay-diagnostics.suggestions.for-pubkey", Op::Read, "RelaySuggestionsForPubkeyInput", "RelaySuggestionsForPubkeyOutput", &["relay_list_suggestions.by_pubkey"], &["relay_list_suggestions"], &["sqlite_relay_list_suggestion_row"], CACHE_READ, DIAG, Ledger::None, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const AUTHOR_ROUTES_PUT_COMMAND: Spec = diagnostics("relay-diagnostics.author-routes.put", Op::Transaction, "AuthorRoutesPutInput", "AuthorRoutesPutOutput", &["author_relay_routes.upsert", "cache_ledger.upsert"], &["author_relay_routes", "cache_ledger"], &["sqlite_author_relay_route_row", "sqlite_cache_ledger_row"], CACHE_WRITE, DIAG_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const AUTHOR_ROUTES_FOR_PUBKEY_COMMAND: Spec = diagnostics("relay-diagnostics.author-routes.for-pubkey", Op::Read, "AuthorRoutesForPubkeyInput", "AuthorRoutesForPubkeyOutput", &["author_relay_routes.by_pubkey"], &["author_relay_routes"], &["sqlite_author_relay_route_row"], CACHE_READ, DIAG, Ledger::None, Protection::RecoverableDiagnostics, Stats::RelayDiagnostics);
#[rustfmt::skip]
pub const ROUTE_BLOCK_PUT_COMMAND: Spec = diagnostics("relay-diagnostics.route-block.put", Op::Write, "RouteBlockPutInput", "RouteBlockPutOutput", &["relay_route_blocks.upsert"], &["relay_route_blocks"], &["sqlite_relay_route_block_row"], PROTECTED_WRITE, SAFETY, Ledger::None, Protection::Protected, Stats::None);
#[rustfmt::skip]
pub const ROUTE_BLOCK_DELETE_COMMAND: Spec = diagnostics("relay-diagnostics.route-block.delete", Op::Write, "RouteBlockDeleteInput", "RouteBlockDeleteOutput", &["relay_route_blocks.delete"], &["relay_route_blocks"], &[], &[Problem::QuotaOrWriteFailed], SAFETY, Ledger::None, Protection::Protected, Stats::None);
#[rustfmt::skip]
pub const ROUTE_BLOCKS_RECENT_COMMAND: Spec = diagnostics("relay-diagnostics.route-block.recent", Op::Read, "RouteBlocksRecentInput", "RouteBlocksRecentOutput", &["relay_route_blocks.recent"], &["relay_route_blocks"], &["sqlite_relay_route_block_row"], PROTECTED_READ, SAFETY, Ledger::None, Protection::Protected, Stats::None);
#[rustfmt::skip]
pub const NOTIFICATIONS_PUT_COMMAND: Spec = diagnostics("relay-diagnostics.notifications.put", Op::Transaction, "NotificationsPutInput", "NotificationsPutOutput", &["notifications.upsert", "cache_ledger.upsert"], &["notifications", "cache_ledger"], &["sqlite_notification_row", "sqlite_cache_ledger_row"], CACHE_WRITE, CACHE_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Protection::RecoverableCache, Stats::CacheSummary);
#[rustfmt::skip]
pub const NOTIFICATIONS_FOR_OWNER_COMMAND: Spec = diagnostics("relay-diagnostics.notifications.for-owner", Op::Read, "NotificationsForOwnerInput", "NotificationsForOwnerOutput", &["notifications.by_owner"], &["notifications"], &["sqlite_notification_row"], CACHE_READ, CACHE, Ledger::None, Protection::RecoverableCache, Stats::None);

pub const DIAGNOSTIC_COMMANDS: &[Spec] = &[
    RELAY_INFORMATION_PUT_COMMAND,
    RELAY_INFORMATION_GET_COMMAND,
    RELAY_INFORMATION_RECENT_COMMAND,
    RELAY_SUMMARY_PUT_COMMAND,
    RELAY_SUMMARY_GET_COMMAND,
    RELAY_SUMMARIES_RECENT_COMMAND,
    RELAY_SUGGESTIONS_PUT_COMMAND,
    RELAY_SUGGESTIONS_FOR_PUBKEY_COMMAND,
    AUTHOR_ROUTES_PUT_COMMAND,
    AUTHOR_ROUTES_FOR_PUBKEY_COMMAND,
    ROUTE_BLOCK_PUT_COMMAND,
    ROUTE_BLOCK_DELETE_COMMAND,
    ROUTE_BLOCKS_RECENT_COMMAND,
    NOTIFICATIONS_PUT_COMMAND,
    NOTIFICATIONS_FOR_OWNER_COMMAND,
];
