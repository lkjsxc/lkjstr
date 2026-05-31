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
    let score_hours = i64::try_from(row.updated_at / 3_600_000).unwrap_or(i64::MAX - 50);
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

pub fn encoded_json_bytes(value: &impl Serialize) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(value).map(|bytes| bytes.len())
}
