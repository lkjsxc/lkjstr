use crate::{
    CacheResourceKind, SqliteCacheLedgerRow, ledger_resource_kinds, ledger_resource_spec,
    sql::{SqliteRetentionClass, sqlite_schema_table},
};

use super::RetentionCandidate;

#[must_use]
pub fn retention_candidate_from_ledger_row(
    row: &SqliteCacheLedgerRow,
) -> Option<RetentionCandidate> {
    let resource_kind = cache_resource_kind(&row.resource_kind)?;
    let retention = sqlite_schema_table(&row.table_name).map(|spec| spec.retention);
    Some(RetentionCandidate {
        resource_id: row.resource_id.clone(),
        resource_kind,
        table_name: row.table_name.clone(),
        byte_count: row.byte_count,
        score: row.score,
        updated_at_ms: row.updated_at_ms,
        protected: row.protected != 0,
        ledger_backed: ledger_resource_spec(resource_kind).is_some(),
        recoverable: retention == Some(SqliteRetentionClass::Recoverable),
    })
}

fn cache_resource_kind(value: &str) -> Option<CacheResourceKind> {
    ledger_resource_kinds()
        .into_iter()
        .find(|kind| kind.as_str() == value)
}
