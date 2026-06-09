#![doc = "SQLite cached-event write calls."]

use lkjstr_storage::{SqliteEventRelayRow, StorageOperation, StorageOutcome, StoredEventRecord};

use crate::sqlite_store::{
    cache_ledger::ledger_step,
    database::SqliteStore,
    event_params::{event_params, relay_params, tag_params},
    params::{params, text},
    search::event_search_index_steps,
};

macro_rules! add_step {
    ($steps:expr, $outcome:expr $(,)?) => {
        match $outcome {
            StorageOutcome::Ok(step) => $steps.push(step),
            outcome => return outcome.map(|_| ()),
        }
    };
}

pub async fn sqlite_event_put(
    store: &SqliteStore,
    row: &StoredEventRecord,
    relays: &[SqliteEventRelayRow],
) -> StorageOutcome<()> {
    let event = match lkjstr_storage::sqlite_event_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("events.upsert", StorageOperation::Write),
    };
    let tags = match lkjstr_storage::sqlite_event_tag_rows(&row.event) {
        Ok(rows) => rows,
        Err(_) => return corrupt("event_tags.upsert", StorageOperation::Write),
    };
    let search_index = match event_search_index_steps(store, &row.event) {
        StorageOutcome::Ok(steps) => steps,
        outcome => return outcome.map(|_| ()),
    };
    let cache_bytes =
        match lkjstr_storage::event_cache_bytes(row, &tags, relays, &search_index.tokens) {
            Ok(bytes) => bytes,
            Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
        };
    let mut steps = Vec::with_capacity(3 + tags.len() + relays.len() + search_index.steps.len());
    add_step!(&mut steps, store.step("events.upsert", event_params(event)));
    add_step!(
        &mut steps,
        store.step(
            "event_tags.delete_by_event",
            params(vec![text(&row.event.id)])
        ),
    );
    for tag in tags {
        add_step!(&mut steps, store.step("event_tags.upsert", tag_params(tag)));
    }
    for relay in relays {
        add_step!(
            &mut steps,
            store.step("event_relays.upsert", relay_params(relay.clone())),
        );
    }
    steps.extend(search_index.steps);
    add_step!(
        &mut steps,
        ledger_step(
            store,
            &lkjstr_storage::event_cache_ledger_record(row, cache_bytes),
            "events",
        ),
    );
    store.batch(steps).await
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "events",
        "corrupt",
        operation_id,
    ))
}
