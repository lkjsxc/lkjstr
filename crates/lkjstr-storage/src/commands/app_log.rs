#![doc = "App log storage command metadata."]

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
const WRITE: &[Problem] = &[Problem::QuotaOrWriteFailed];
const LOG: &[Class] = &[Class::DiagnosticsCache];

const fn log(
    id: &'static str,
    operation: Op,
    input_type: &'static str,
    output_type: &'static str,
    statements: &'static [&'static str],
    row_codecs: &'static [&'static str],
    problem_kinds: &'static [Problem],
) -> Spec {
    Spec {
        id,
        family: Family::AppLog,
        operation,
        input_type,
        output_type,
        statements,
        tables: &["app_log"],
        row_codecs,
        problem_kinds,
        data_classes: LOG,
        ledger_policy: Ledger::None,
        protection_policy: Protection::RecoverableDiagnostics,
        stats_projection: Stats::AppLog,
    }
}

#[rustfmt::skip]
pub const APP_LOG_INSERT_COMMAND: Spec = log("app-log.insert", Op::Write, "AppLogInsertInput", "AppLogInsertOutput", &["app_log.insert"], &["sqlite_app_log_row"], CACHE_WRITE);
#[rustfmt::skip]
pub const APP_LOG_RECENT_COMMAND: Spec = log("app-log.recent", Op::Read, "AppLogRecentInput", "AppLogRecentOutput", &["app_log.recent"], &["sqlite_app_log_row"], CACHE_READ);
#[rustfmt::skip]
pub const APP_LOG_CLEAR_BEFORE_COMMAND: Spec = log("app-log.clear-before", Op::Write, "AppLogClearBeforeInput", "AppLogClearBeforeOutput", &["app_log.clear_before"], &[], WRITE);

pub const APP_LOG_COMMANDS: &[Spec] = &[
    APP_LOG_INSERT_COMMAND,
    APP_LOG_RECENT_COMMAND,
    APP_LOG_CLEAR_BEFORE_COMMAND,
];
