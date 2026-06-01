#![doc = "Tab-state storage row and ledger helpers."]

use lkjstr_domain::TabSnapshotPayload;
use serde::{Deserialize, Serialize};

use crate::resource::{CacheOwnerKind, CacheResourceKind};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabStateRecord {
    pub id: String,
    pub workspace_id: String,
    pub tab_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_pane_id: Option<String>,
    pub state: TabSnapshotPayload,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheLedgerRecord {
    pub id: String,
    pub owner_kind: CacheOwnerKind,
    pub resource_kind: CacheResourceKind,
    pub resource_id: String,
    pub score: i64,
    pub created_at: u64,
    pub updated_at: u64,
    pub cache_bytes: usize,
    pub protected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_pubkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feed_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relay_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteTabStateRow {
    pub workspace_id: String,
    pub tab_id: String,
    pub tab_kind: String,
    pub snapshot_json: String,
    pub scroll_anchor_json: Option<String>,
    pub updated_at_ms: u64,
    pub stale_after_ms: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteCacheLedgerRow {
    pub resource_id: String,
    pub resource_kind: String,
    pub table_name: String,
    pub byte_count: u64,
    pub protected: i64,
    pub score: i64,
    pub owner_key: Option<String>,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn tab_state_id(workspace_id: &str, tab_id: &str) -> String {
    format!("{workspace_id}:{tab_id}")
}

#[must_use]
pub fn cache_ledger_id(owner_kind: CacheOwnerKind, resource_id: &str) -> String {
    format!("{}:{resource_id}", owner_kind.as_str())
}

pub fn tab_state_ledger_record(
    row: &TabStateRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    let score_hours = (row.updated_at / 3_600_000).min((i64::MAX - 50) as u64) as i64;
    let mut draft = CacheLedgerRecord {
        id: cache_ledger_id(CacheOwnerKind::TabSnapshot, &row.id),
        owner_kind: CacheOwnerKind::TabSnapshot,
        resource_kind: CacheResourceKind::TabState,
        resource_id: row.id.clone(),
        score: 50 + score_hours,
        created_at: row.updated_at,
        updated_at: row.updated_at,
        cache_bytes: 0,
        protected: false,
        account_pubkey: None,
        feed_key: None,
        relay_url: None,
        reason: Some("tab-snapshot".to_owned()),
    };
    draft.cache_bytes = encoded_json_bytes(row)? + encoded_json_bytes(&draft)?;
    Ok(draft)
}

pub fn encoded_json_bytes<T: Serialize + ?Sized>(value: &T) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(value).map(|bytes| bytes.len())
}

pub fn sqlite_tab_state_row(row: &TabStateRecord) -> Result<SqliteTabStateRow, serde_json::Error> {
    Ok(SqliteTabStateRow {
        workspace_id: row.workspace_id.clone(),
        tab_id: row.tab_id.clone(),
        tab_kind: tab_state_kind(&row.state).to_owned(),
        snapshot_json: serde_json::to_string(row)?,
        scroll_anchor_json: None,
        updated_at_ms: row.updated_at,
        stale_after_ms: None,
    })
}

pub fn tab_state_from_sqlite_row(
    row: &SqliteTabStateRow,
) -> Result<TabStateRecord, serde_json::Error> {
    serde_json::from_str(&row.snapshot_json)
}

pub fn sqlite_cache_ledger_row(ledger: &CacheLedgerRecord) -> SqliteCacheLedgerRow {
    sqlite_cache_ledger_row_for_table(ledger, "tab_states")
}

pub fn sqlite_cache_ledger_row_for_table(
    ledger: &CacheLedgerRecord,
    table_name: &str,
) -> SqliteCacheLedgerRow {
    SqliteCacheLedgerRow {
        resource_id: ledger.resource_id.clone(),
        resource_kind: ledger.resource_kind.as_str().to_owned(),
        table_name: table_name.to_owned(),
        byte_count: ledger.cache_bytes as u64,
        protected: i64::from(ledger.protected),
        score: ledger.score,
        owner_key: ledger.account_pubkey.clone(),
        created_at_ms: ledger.created_at,
        updated_at_ms: ledger.updated_at,
    }
}

fn tab_state_kind(payload: &TabSnapshotPayload) -> &'static str {
    match payload {
        TabSnapshotPayload::Feed(_) => "feed",
        TabSnapshotPayload::Tool(_) => "tool",
    }
}
