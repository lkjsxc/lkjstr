#![doc = "SQLite relay route repository calls."]

use lkjstr_storage::{
    AuthorRelayRouteRecord, RelayListSuggestionRecord, RelayRouteBlockRecord,
    SqliteAuthorRelayRouteRow, SqliteRelayListSuggestionRow, SqliteRelayRouteBlockRow,
    StorageOperation, StorageOutcome,
};

use crate::sqlite_store::{
    cache_ledger::ledger_step,
    database::SqliteStore,
    diagnostic_params::{author_route_params, relay_suggestion_params, route_block_params},
    params::{integer, params, text},
    rows::all_rows,
};

macro_rules! add_step {
    ($steps:expr, $outcome:expr $(,)?) => {
        match $outcome {
            StorageOutcome::Ok(step) => $steps.push(step),
            outcome => return outcome.map(|_| ()),
        }
    };
}

pub async fn sqlite_relay_suggestions_put(
    store: &SqliteStore,
    rows: &[RelayListSuggestionRecord],
) -> StorageOutcome<()> {
    let mut steps = Vec::with_capacity(rows.len() * 2);
    for row in rows {
        let ledger = match lkjstr_storage::relay_suggestion_ledger_record(row) {
            Ok(row) => row,
            Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
        };
        add_step!(
            &mut steps,
            store.step(
                "relay_list_suggestions.upsert",
                relay_suggestion_params(row.clone()),
            ),
        );
        add_step!(
            &mut steps,
            ledger_step(store, &ledger, "relay_list_suggestions")
        );
    }
    store.batch(steps).await
}

pub async fn sqlite_relay_suggestions_for_pubkey(
    store: &SqliteStore,
    pubkey: &str,
) -> StorageOutcome<Vec<RelayListSuggestionRecord>> {
    let rows = match store
        .query(
            "relay_list_suggestions.by_pubkey",
            params(vec![text(pubkey)]),
            500,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows::<SqliteRelayListSuggestionRow>(
        rows,
        "relay_list_suggestions",
        "relay_list_suggestions.by_pubkey",
    )
}

pub async fn sqlite_author_routes_put(
    store: &SqliteStore,
    rows: &[AuthorRelayRouteRecord],
) -> StorageOutcome<()> {
    let mut steps = Vec::with_capacity(rows.len() * 2);
    for row in rows {
        let ledger = match lkjstr_storage::author_route_ledger_record(row) {
            Ok(row) => row,
            Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
        };
        add_step!(
            &mut steps,
            store.step(
                "author_relay_routes.upsert",
                author_route_params(row.clone())
            ),
        );
        add_step!(
            &mut steps,
            ledger_step(store, &ledger, "author_relay_routes")
        );
    }
    store.batch(steps).await
}

pub async fn sqlite_author_routes_for_pubkey(
    store: &SqliteStore,
    pubkey: &str,
    now_ms: u64,
) -> StorageOutcome<Vec<AuthorRelayRouteRecord>> {
    let rows = match store
        .query(
            "author_relay_routes.by_pubkey",
            params(vec![text(pubkey), integer(now_ms)]),
            500,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows::<SqliteAuthorRelayRouteRow>(
        rows,
        "author_relay_routes",
        "author_relay_routes.by_pubkey",
    )
}

pub async fn sqlite_route_block_put(
    store: &SqliteStore,
    row: &RelayRouteBlockRecord,
) -> StorageOutcome<()> {
    store
        .execute("relay_route_blocks.upsert", route_block_params(row.clone()))
        .await
}

pub async fn sqlite_route_block_delete(
    store: &SqliteStore,
    relay_url: &str,
    pubkey: &str,
) -> StorageOutcome<()> {
    store
        .execute(
            "relay_route_blocks.delete",
            params(vec![text(relay_url), text(pubkey)]),
        )
        .await
}

pub async fn sqlite_route_blocks_recent(
    store: &SqliteStore,
    limit: u64,
) -> StorageOutcome<Vec<RelayRouteBlockRecord>> {
    let rows = match store
        .query(
            "relay_route_blocks.recent",
            params(vec![integer(limit)]),
            limit as u32,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows::<SqliteRelayRouteBlockRow>(rows, "relay_route_blocks", "relay_route_blocks.recent")
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "relay_routes",
        "corrupt",
        operation_id,
    ))
}
