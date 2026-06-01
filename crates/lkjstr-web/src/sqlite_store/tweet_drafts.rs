#![doc = "SQLite Tweet draft repository calls."]

use lkjstr_storage::{
    SqliteTweetDraftRow, StorageOutcome, TweetDraftRecord, sqlite_tweet_draft_row,
    tweet_draft_from_sqlite_row,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, opt_text, params, text},
    rows::first_row,
};

pub async fn sqlite_tweet_draft_put(
    store: &SqliteStore,
    row: &TweetDraftRecord,
) -> StorageOutcome<()> {
    let row = match sqlite_tweet_draft_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("tweet_drafts.upsert"),
    };
    store
        .execute(
            "tweet_drafts.upsert",
            params(vec![
                text(row.draft_id),
                opt_text(row.owner_pubkey),
                text(row.body),
                text(row.attachments_json),
                text(row.tags_json),
                integer(row.updated_at_ms),
            ]),
        )
        .await
}

pub async fn sqlite_tweet_draft_delete(store: &SqliteStore, id: &str) -> StorageOutcome<()> {
    store
        .execute("tweet_drafts.delete", params(vec![text(id)]))
        .await
}

pub async fn sqlite_tweet_draft_get(
    store: &SqliteStore,
    id: &str,
) -> StorageOutcome<Option<TweetDraftRecord>> {
    let rows = match store
        .query("tweet_drafts.select", params(vec![text(id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteTweetDraftRow>(rows, "tweet_drafts", "tweet_drafts.select") {
        StorageOutcome::Ok(Some(row)) => match tweet_draft_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("tweet_drafts.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        lkjstr_storage::StorageOperation::Read,
        "tweet_drafts",
        "corrupt",
        operation_id,
    ))
}
