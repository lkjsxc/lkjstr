#![doc = "Relay diagnostics SQLite row codecs and ledger helpers."]

use serde::{Deserialize, Serialize};

use crate::{
    CacheLedgerRecord,
    resource::{CacheOwnerKind, CacheResourceKind},
    tab_state::{cache_ledger_id, encoded_json_bytes},
};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RelayDiagnosticSummaryRecord {
    pub relay_url: String,
    pub summary_json: String,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RelayInformationRecord {
    pub relay_url: String,
    pub info_json: String,
    pub fetched_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RelayListSuggestionRecord {
    pub pubkey: String,
    pub relay_url: String,
    pub purpose: String,
    pub source_event_id: String,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AuthorRelayRouteRecord {
    pub pubkey: String,
    pub relay_url: String,
    pub route_kind: String,
    pub evidence_json: String,
    pub updated_at_ms: u64,
    pub expires_at_ms: Option<u64>,
}

pub type SqliteRelayDiagnosticSummaryRow = RelayDiagnosticSummaryRecord;
pub type SqliteRelayInformationRow = RelayInformationRecord;
pub type SqliteRelayListSuggestionRow = RelayListSuggestionRecord;
pub type SqliteAuthorRelayRouteRow = AuthorRelayRouteRecord;

pub fn relay_summary_ledger_record(
    row: &RelayDiagnosticSummaryRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    relay_ledger(
        CacheOwnerKind::RelayDiagnostic,
        CacheResourceKind::RelaySummary,
        &row.relay_url,
        &row.relay_url,
        row.updated_at_ms,
        80,
        row,
    )
}

pub fn relay_info_ledger_record(
    row: &RelayInformationRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    relay_ledger(
        CacheOwnerKind::RelayInformation,
        CacheResourceKind::RelayInfo,
        &row.relay_url,
        &row.relay_url,
        row.fetched_at_ms,
        350,
        row,
    )
}

pub fn relay_suggestion_ledger_record(
    row: &RelayListSuggestionRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    let id = format!("{}:{}:{}", row.pubkey, row.relay_url, row.purpose);
    relay_ledger(
        CacheOwnerKind::RelaySuggestion,
        CacheResourceKind::RelayListSuggestion,
        &id,
        &row.relay_url,
        row.updated_at_ms,
        300,
        row,
    )
}

pub fn author_route_ledger_record(
    row: &AuthorRelayRouteRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    let id = format!("{}:{}:{}", row.pubkey, row.relay_url, row.route_kind);
    relay_ledger(
        CacheOwnerKind::RouteEvidence,
        CacheResourceKind::AuthorRelayRoute,
        &id,
        &row.relay_url,
        row.updated_at_ms,
        300,
        row,
    )
}

fn relay_ledger(
    owner_kind: CacheOwnerKind,
    resource_kind: CacheResourceKind,
    resource_id: &str,
    relay_url: &str,
    updated_at_ms: u64,
    base_score: i64,
    row: &impl Serialize,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    Ok(CacheLedgerRecord {
        id: cache_ledger_id(owner_kind, resource_id),
        owner_kind,
        resource_kind,
        resource_id: resource_id.to_owned(),
        score: base_score + hour_bucket(updated_at_ms),
        created_at: updated_at_ms,
        updated_at: updated_at_ms,
        cache_bytes: encoded_json_bytes(row)?,
        protected: false,
        account_pubkey: None,
        feed_key: None,
        relay_url: Some(relay_url.to_owned()),
        reason: Some("recoverable-relay-cache".to_owned()),
    })
}

fn hour_bucket(updated_at_ms: u64) -> i64 {
    (updated_at_ms / 3_600_000).min(i64::MAX as u64) as i64
}
