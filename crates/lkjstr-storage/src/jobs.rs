#![doc = "Job SQLite row codecs and ledger helpers."]

use serde::{Deserialize, Serialize};

use crate::{
    CacheLedgerRecord,
    resource::{CacheOwnerKind, CacheResourceKind},
    tab_state::{cache_ledger_id, encoded_json_bytes},
};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct JobRecord {
    pub job_id: String,
    pub job_kind: String,
    pub state: String,
    pub owner_id: Option<String>,
    pub payload_json: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub finished_at_ms: Option<u64>,
}

pub type SqliteJobRow = JobRecord;

pub fn job_ledger_record(row: &JobRecord) -> Result<CacheLedgerRecord, serde_json::Error> {
    let protected = active_job_state(&row.state);
    let base_score = if row.state == "failed" { 250 } else { 100 };
    Ok(CacheLedgerRecord {
        id: cache_ledger_id(CacheOwnerKind::Job, &row.job_id),
        owner_kind: CacheOwnerKind::Job,
        resource_kind: CacheResourceKind::JobRecord,
        resource_id: row.job_id.clone(),
        score: base_score + hour_bucket(row.updated_at_ms),
        created_at: row.created_at_ms,
        updated_at: row.updated_at_ms,
        cache_bytes: encoded_json_bytes(row)?,
        protected,
        account_pubkey: None,
        feed_key: None,
        relay_url: None,
        reason: Some(
            if protected {
                "active-job"
            } else {
                "finished-job"
            }
            .to_owned(),
        ),
    })
}

fn active_job_state(state: &str) -> bool {
    matches!(state, "queued" | "running" | "pending")
}

fn hour_bucket(updated_at_ms: u64) -> i64 {
    (updated_at_ms / 3_600_000).min(i64::MAX as u64) as i64
}
