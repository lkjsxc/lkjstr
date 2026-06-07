#![doc = "Notification row helpers for SQLite storage."]

use serde::{Deserialize, Serialize};

use crate::{
    CacheLedgerRecord,
    resource::{CacheOwnerKind, CacheResourceKind},
    tab_state::{cache_ledger_id, encoded_json_bytes},
};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct NotificationRecord {
    pub notification_id: String,
    pub owner_pubkey: String,
    pub source_event_id: String,
    pub target_event_id: Option<String>,
    pub root_event_id: Option<String>,
    pub actor_pubkey: String,
    pub notification_kind: String,
    pub created_at: u64,
    pub updated_at_ms: u64,
}

pub type SqliteNotificationRow = NotificationRecord;

#[must_use]
pub fn sqlite_notification_row(row: &NotificationRecord) -> SqliteNotificationRow {
    row.clone()
}

pub fn notification_ledger_record(
    row: &NotificationRecord,
) -> Result<CacheLedgerRecord, serde_json::Error> {
    Ok(CacheLedgerRecord {
        id: cache_ledger_id(CacheOwnerKind::Notification, &row.notification_id),
        owner_kind: CacheOwnerKind::Notification,
        resource_kind: CacheResourceKind::NotificationRecord,
        resource_id: row.notification_id.clone(),
        score: row.created_at.min(i64::MAX as u64) as i64,
        created_at: row.updated_at_ms,
        updated_at: row.updated_at_ms,
        cache_bytes: encoded_json_bytes(row)?,
        protected: false,
        account_pubkey: Some(row.owner_pubkey.clone()),
        feed_key: None,
        relay_url: None,
        reason: Some("notification".to_owned()),
    })
}
