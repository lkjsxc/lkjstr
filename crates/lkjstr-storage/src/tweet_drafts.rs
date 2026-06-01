#![doc = "Tweet draft storage row helpers."]

use lkjstr_domain::TweetDraft;
use serde::{Deserialize, Serialize};

pub type TweetDraftRecord = TweetDraft;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteTweetDraftRow {
    pub draft_id: String,
    pub owner_pubkey: Option<String>,
    pub body: String,
    pub attachments_json: String,
    pub tags_json: String,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn tweet_draft_record_id(row: &TweetDraftRecord) -> &str {
    &row.id
}

pub fn tweet_draft_record_json_bytes(row: &TweetDraftRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_tweet_draft_row(
    row: &TweetDraftRecord,
) -> Result<SqliteTweetDraftRow, serde_json::Error> {
    Ok(SqliteTweetDraftRow {
        draft_id: row.id.clone(),
        owner_pubkey: row
            .account_id
            .as_deref()
            .map(crate::accounts::account_sqlite_key),
        body: row.content.clone(),
        attachments_json: serde_json::to_string(&row.attachments)?,
        tags_json: serde_json::to_string(row)?,
        updated_at_ms: row.updated_at,
    })
}

pub fn tweet_draft_from_sqlite_row(
    row: &SqliteTweetDraftRow,
) -> Result<TweetDraftRecord, serde_json::Error> {
    serde_json::from_str(&row.tags_json)
}
