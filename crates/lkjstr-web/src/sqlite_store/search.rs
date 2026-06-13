#![doc = "SQLite Search repository helpers."]

use lkjstr_protocol::NostrEvent;
use lkjstr_storage::{
    SearchCursor, SqliteEventSearchTokenRow, StorageOutcome, StoredEventRecord,
};

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
    sqlite_search_local_query_before(store, query, limit, None).await
}

pub async fn sqlite_search_local_query_before(
    store: &SqliteStore,
    query: &str,
    limit: u64,
    before: Option<&SearchCursor>,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    let tokens = lkjstr_storage::tokenize_search_query(query);
    sqlite_search_local_tokens_before(store, &tokens, limit, before).await
}

pub async fn sqlite_search_local_tokens(
    store: &SqliteStore,
    tokens: &[String],
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    sqlite_search_local_tokens_before(store, tokens, limit, None).await
}

pub async fn sqlite_search_local_tokens_before(
    store: &SqliteStore,
    tokens: &[String],
    limit: u64,
    before: Option<&SearchCursor>,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    if tokens.is_empty() || limit == 0 {
        return StorageOutcome::Ok(Vec::new());
    }
    let mut groups = Vec::with_capacity(tokens.len());
    for token in tokens {
        match search_token_rows(store, token, limit, before).await {
            StorageOutcome::Ok(rows) => groups.push(rows),
            outcome => return outcome.map(|_| Vec::new()),
        }
    }
    let event_ids = lkjstr_storage::local_search_event_ids_before(&groups, limit, before);
    fetch_search_events(store, event_ids).await
}

async fn search_token_rows(
    store: &SqliteStore,
    token: &str,
    limit: u64,
    before: Option<&SearchCursor>,
) -> StorageOutcome<Vec<SqliteEventSearchTokenRow>> {
    let row_limit = lkjstr_storage::search_candidate_row_limit(limit).min(u32::MAX as u64);
    let statement = if before.is_some() {
        "event_search_tokens.by_token_before"
    } else {
        "event_search_tokens.by_token"
    };
    let params = search_token_query_params(token, row_limit, before);
    let rows = match store
        .query(statement, params, row_limit as u32)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows(rows, "event_search_tokens", statement)
}

fn search_token_query_params(
    token: &str,
    row_limit: u64,
    before: Option<&SearchCursor>,
) -> Option<crate::storage_worker::SqlParams> {
    match before {
        Some(cursor) => params(vec![
            text(token),
            integer(cursor.created_at),
            text(&cursor.event_id),
            integer(row_limit),
        ]),
        None => params(vec![text(token), integer(row_limit)]),
    }
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
