#![doc = "SQLite diagnostics parameter helpers."]

use lkjstr_storage::{
    AppLogRecord, AuthorRelayRouteRecord, JobRecord, RelayDiagnosticSummaryRecord,
    RelayInformationRecord, RelayListSuggestionRecord, RelayRouteBlockRecord,
};

use crate::{
    sqlite_store::params::{integer, opt_integer, params, text},
    storage_worker::SqlParams,
};

pub fn relay_summary_params(row: RelayDiagnosticSummaryRecord) -> Option<SqlParams> {
    params(vec![
        text(row.relay_url),
        text(row.summary_json),
        integer(row.updated_at_ms),
    ])
}

pub fn relay_info_params(row: RelayInformationRecord) -> Option<SqlParams> {
    params(vec![
        text(row.relay_url),
        text(row.info_json),
        integer(row.fetched_at_ms),
        integer(row.updated_at_ms),
    ])
}

pub fn relay_suggestion_params(row: RelayListSuggestionRecord) -> Option<SqlParams> {
    params(vec![
        text(row.pubkey),
        text(row.relay_url),
        text(row.purpose),
        text(row.source_event_id),
        integer(row.updated_at_ms),
    ])
}

pub fn author_route_params(row: AuthorRelayRouteRecord) -> Option<SqlParams> {
    params(vec![
        text(row.pubkey),
        text(row.relay_url),
        text(row.route_kind),
        text(row.evidence_json),
        integer(row.updated_at_ms),
        opt_integer(row.expires_at_ms),
    ])
}

pub fn route_block_params(row: RelayRouteBlockRecord) -> Option<SqlParams> {
    params(vec![
        text(row.relay_url),
        text(row.pubkey),
        text(row.reason),
        integer(row.created_at_ms),
    ])
}

pub fn job_params(row: JobRecord) -> Option<SqlParams> {
    params(vec![
        text(row.job_id),
        text(row.job_kind),
        text(row.state),
        row.owner_id
            .map_or(crate::storage_worker::SqlScalar::Null, text),
        text(row.payload_json),
        integer(row.created_at_ms),
        integer(row.updated_at_ms),
        opt_integer(row.finished_at_ms),
    ])
}

pub fn app_log_params(row: AppLogRecord) -> Option<SqlParams> {
    params(vec![
        text(row.log_id),
        text(row.level),
        text(row.message),
        text(row.context_json),
        integer(row.created_at_ms),
    ])
}
