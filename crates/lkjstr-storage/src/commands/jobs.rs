#![doc = "Job storage command metadata."]

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
const JOB: &[Class] = &[Class::RecoverableCache];
const JOB_AND_LEDGER: &[Class] = &[Class::RecoverableCache, Class::Ledger];

#[allow(clippy::too_many_arguments)]
const fn job(
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
) -> Spec {
    Spec {
        id,
        family: Family::Jobs,
        operation,
        input_type,
        output_type,
        statements,
        tables,
        row_codecs,
        problem_kinds,
        data_classes,
        ledger_policy,
        protection_policy: Protection::RecoverableDiagnostics,
        stats_projection: Stats::Jobs,
    }
}

#[rustfmt::skip]
pub const JOB_PUT_COMMAND: Spec = job("jobs.put", Op::Transaction, "JobPutInput", "JobPutOutput", &["jobs.upsert", "cache_ledger.upsert"], &["jobs", "cache_ledger"], &["sqlite_job_row", "sqlite_cache_ledger_row"], CACHE_WRITE, JOB_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch);
#[rustfmt::skip]
pub const JOB_GET_COMMAND: Spec = job("jobs.get", Op::Read, "JobGetInput", "JobGetOutput", &["jobs.select"], &["jobs"], &["sqlite_job_row"], CACHE_READ, JOB, Ledger::None);
#[rustfmt::skip]
pub const JOBS_RECENT_COMMAND: Spec = job("jobs.recent", Op::Read, "JobsRecentInput", "JobsRecentOutput", &["jobs.recent"], &["jobs"], &["sqlite_job_row"], CACHE_READ, JOB, Ledger::None);

pub const JOB_COMMANDS: &[Spec] = &[JOB_PUT_COMMAND, JOB_GET_COMMAND, JOBS_RECENT_COMMAND];
