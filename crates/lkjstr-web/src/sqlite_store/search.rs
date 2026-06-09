#![doc = "SQLite Search index step helpers."]

use lkjstr_protocol::NostrEvent;
use lkjstr_storage::{SqliteEventSearchTokenRow, StorageOutcome};

use crate::{
    sqlite_store::{SqliteStore, event_params::search_token_params, params::params, params::text},
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

fn empty_steps() -> SearchIndexSteps {
    SearchIndexSteps {
        tokens: Vec::new(),
        steps: Vec::new(),
    }
}
