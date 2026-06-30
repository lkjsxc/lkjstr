use lkjstr_storage::{StorageOutcome, TweetDraftRecord, tweet_draft_record_id};

use crate::indexed_db::database::{LEGACY_INDEXED_DB_NAME, TWEET_DRAFTS_TABLE};
use crate::indexed_db::{record_requests, record_write};

pub async fn default_tweet_draft_get(id: &str) -> StorageOutcome<Option<TweetDraftRecord>> {
    tweet_draft_get(LEGACY_INDEXED_DB_NAME, id).await
}

pub async fn tweet_draft_put(db_name: &str, row: &TweetDraftRecord) -> StorageOutcome<()> {
    record_write::put(db_name, TWEET_DRAFTS_TABLE, tweet_draft_record_id(row), row).await
}

pub async fn tweet_draft_delete(db_name: &str, id: &str) -> StorageOutcome<()> {
    record_write::delete(db_name, TWEET_DRAFTS_TABLE, id).await
}

pub async fn tweet_draft_get(db_name: &str, id: &str) -> StorageOutcome<Option<TweetDraftRecord>> {
    record_requests::get(db_name, TWEET_DRAFTS_TABLE, id).await
}
