#![doc = "SQLite Search repository helpers."]

use lkjstr_protocol::NostrEvent;
use lkjstr_storage::{SqliteEventSearchTokenRow, StorageOutcome, StoredEventRecord};

use crate::{
    sqlite_store::{
        SqliteStore,
        event_params::search_token_params,
        params::{integer, params, text},
        rows::all_rows,
    },
    storage_worker::SqlStep,
};

pub(crate) struct SearchIndexSteps {
    pub tokens: Vec<SqliteEventSearchTokenRow>,
    pub steps: Vec<SqlStep>,
}

pub(crate) fn event_search_index_steps(
    store: &SqliteStore,
    event: &NostrEvent,
) -> StorageOutcome<SearchIndexSteps> {
    let tokens = lkjstr_storage::event_search_token_rows(event);
    let mut steps = Vec::with_capacity(tokens.len() + 1);
    match store.step(
        "event_search_tokens.delete_by_event",
        params(vec![text(&event.id)]),
    ) {
        StorageOutcome::Ok(step) => steps.push(step),
        outcome => return outcome.map(|_| empty_steps()),
    }
    for token in &tokens {
        match store.step(
            "event_search_tokens.upsert",
            search_token_params(token.clone()),
        ) {
            StorageOutcome::Ok(step) => steps.push(step),
            outcome => return outcome.map(|_| empty_steps()),
        }
    }
    StorageOutcome::Ok(SearchIndexSteps { tokens, steps })
}

pub async fn sqlite_search_local_query(
    store: &SqliteStore,
    query: &str,
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    let tokens = lkjstr_storage::tokenize_search_query(query);
    sqlite_search_local_tokens(store, &tokens, limit).await
}

pub async fn sqlite_search_local_tokens(
    store: &SqliteStore,
    tokens: &[String],
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    if tokens.is_empty() || limit == 0 {
        return StorageOutcome::Ok(Vec::new());
    }
    let mut groups = Vec::with_capacity(tokens.len());
    for token in tokens {
        match search_token_rows(store, token, limit).await {
            StorageOutcome::Ok(rows) => groups.push(rows),
            outcome => return outcome.map(|_| Vec::new()),
        }
    }
    let event_ids = lkjstr_storage::local_search_event_ids(&groups, limit);
    fetch_search_events(store, event_ids).await
}

async fn search_token_rows(
    store: &SqliteStore,
    token: &str,
    limit: u64,
) -> StorageOutcome<Vec<SqliteEventSearchTokenRow>> {
    let row_limit = lkjstr_storage::search_candidate_row_limit(limit).min(u32::MAX as u64);
    let rows = match store
        .query(
            "event_search_tokens.by_token",
            params(vec![text(token), integer(row_limit)]),
            row_limit as u32,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows(rows, "event_search_tokens", "event_search_tokens.by_token")
}

async fn fetch_search_events(
    store: &SqliteStore,
    event_ids: Vec<String>,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    let mut events = Vec::with_capacity(event_ids.len());
    for event_id in event_ids {
        match super::events::sqlite_event_get(store, &event_id).await {
            StorageOutcome::Ok(Some(event)) => events.push(event),
            StorageOutcome::Ok(None) => {}
            outcome => return outcome.map(|_| Vec::new()),
        }
    }
    StorageOutcome::Ok(events)
}

fn empty_steps() -> SearchIndexSteps {
    SearchIndexSteps {
        tokens: Vec::new(),
        steps: Vec::new(),
    }
}
