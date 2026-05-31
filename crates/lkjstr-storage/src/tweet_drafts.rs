#![doc = "Tweet draft storage row helpers."]

use lkjstr_domain::TweetDraft;

pub type TweetDraftRecord = TweetDraft;

#[must_use]
pub fn tweet_draft_record_id(row: &TweetDraftRecord) -> &str {
    &row.id
}

pub fn tweet_draft_record_json_bytes(row: &TweetDraftRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}
