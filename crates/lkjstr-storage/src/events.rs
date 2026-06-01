#![doc = "Cached event row helpers for SQLite storage."]

use lkjstr_protocol::{NostrEvent, NostrTag};
use serde::{Deserialize, Serialize};

use crate::{
    CacheLedgerRecord,
    resource::{CacheOwnerKind, CacheResourceKind},
    tab_state::{cache_ledger_id, encoded_json_bytes},
};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StoredEventRecord {
    pub event: NostrEvent,
    pub received_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteEventRow {
    pub event_id: String,
    pub pubkey: String,
    pub kind: u64,
    pub created_at: u64,
    pub sig: String,
    pub content: String,
    pub raw_json: String,
    pub received_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteEventTagRow {
    pub event_id: String,
    pub tag_index: u64,
    pub tag_name: String,
    pub value_0: Option<String>,
    pub value_1: Option<String>,
    pub value_2: Option<String>,
    pub raw_json: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteEventRelayRow {
    pub event_id: String,
    pub relay_url: String,
    pub first_seen_at_ms: u64,
    pub last_seen_at_ms: u64,
    pub source_kind: String,
}

pub fn sqlite_event_row(row: &StoredEventRecord) -> Result<SqliteEventRow, serde_json::Error> {
    Ok(SqliteEventRow {
        event_id: row.event.id.clone(),
        pubkey: row.event.pubkey.clone(),
        kind: row.event.kind,
        created_at: row.event.created_at,
        sig: row.event.sig.clone(),
        content: row.event.content.clone(),
        raw_json: serde_json::to_string(&row.event)?,
        received_at_ms: row.received_at_ms,
        updated_at_ms: row.updated_at_ms,
    })
}

pub fn event_from_sqlite_row(row: &SqliteEventRow) -> Result<StoredEventRecord, serde_json::Error> {
    Ok(StoredEventRecord {
        event: serde_json::from_str(&row.raw_json)?,
        received_at_ms: row.received_at_ms,
        updated_at_ms: row.updated_at_ms,
    })
}

pub fn sqlite_event_tag_rows(
    event: &NostrEvent,
) -> Result<Vec<SqliteEventTagRow>, serde_json::Error> {
    event
        .tags
        .iter()
        .enumerate()
        .map(|(index, tag)| sqlite_event_tag_row(event, index as u64, tag))
        .collect()
}

#[must_use]
pub fn sqlite_event_relay_row(
    event_id: &str,
    relay_url: &str,
    seen_at_ms: u64,
    source_kind: &str,
) -> SqliteEventRelayRow {
    SqliteEventRelayRow {
        event_id: event_id.to_owned(),
        relay_url: relay_url.to_owned(),
        first_seen_at_ms: seen_at_ms,
        last_seen_at_ms: seen_at_ms,
        source_kind: source_kind.to_owned(),
    }
}

pub fn event_cache_ledger_record(row: &StoredEventRecord, cache_bytes: usize) -> CacheLedgerRecord {
    CacheLedgerRecord {
        id: cache_ledger_id(CacheOwnerKind::Event, &row.event.id),
        owner_kind: CacheOwnerKind::Event,
        resource_kind: CacheResourceKind::NostrEvent,
        resource_id: row.event.id.clone(),
        score: event_score(row),
        created_at: row.received_at_ms,
        updated_at: row.updated_at_ms,
        cache_bytes,
        protected: false,
        account_pubkey: Some(row.event.pubkey.clone()),
        feed_key: None,
        relay_url: None,
        reason: Some("event-cache".to_owned()),
    }
}

pub fn event_cache_bytes(
    row: &StoredEventRecord,
    tags: &[SqliteEventTagRow],
    relays: &[SqliteEventRelayRow],
) -> Result<usize, serde_json::Error> {
    Ok(encoded_json_bytes(row)? + encoded_json_bytes(&tags)? + encoded_json_bytes(&relays)?)
}

fn sqlite_event_tag_row(
    event: &NostrEvent,
    index: u64,
    tag: &NostrTag,
) -> Result<SqliteEventTagRow, serde_json::Error> {
    Ok(SqliteEventTagRow {
        event_id: event.id.clone(),
        tag_index: index,
        tag_name: tag.first().cloned().map_or_else(String::new, String::from),
        value_0: tag.get(1).cloned(),
        value_1: tag.get(2).cloned(),
        value_2: tag.get(3).cloned(),
        raw_json: serde_json::to_string(tag)?,
    })
}

fn event_score(row: &StoredEventRecord) -> i64 {
    recency_bucket(row.event.created_at)
        + kind_weight(row.event.kind)
        + structural_source_weight(&row.event)
}

fn recency_bucket(created_at: u64) -> i64 {
    ((created_at / 3_600).min(i64::MAX as u64 / 100) as i64) * 100
}

fn kind_weight(kind: u64) -> i64 {
    match kind {
        0 | 3 => 10_000,
        1 => 1_000,
        6 | 16 => 800,
        7 | 9735 => 600,
        _ => 300,
    }
}

fn structural_source_weight(event: &NostrEvent) -> i64 {
    event.tags.iter().fold(0, |score, tag| {
        score
            + match tag.first().map(String::as_str) {
                Some("e") => 500,
                Some("q") => 400,
                Some("p") => 100,
                _ => 0,
            }
    })
}
