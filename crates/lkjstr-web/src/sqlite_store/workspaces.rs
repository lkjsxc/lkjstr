#![doc = "SQLite workspace repository calls."]

use lkjstr_storage::{
    SqliteWorkspaceRow, StorageOutcome, WorkspaceRecord, sqlite_workspace_row,
    workspace_from_sqlite_row,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, opt_text, params, text},
    rows::first_row,
};

pub async fn sqlite_workspace_put(
    store: &SqliteStore,
    row: &WorkspaceRecord,
) -> StorageOutcome<()> {
    let row = match sqlite_workspace_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("workspaces.upsert"),
    };
    store
        .execute(
            "workspaces.upsert",
            params(vec![
                text(row.workspace_id),
                text(row.layout_json),
                opt_text(row.active_pane_id),
                opt_text(row.active_tab_id),
                integer(row.created_at_ms),
                integer(row.updated_at_ms),
            ]),
        )
        .await
}

pub async fn sqlite_workspace_get(
    store: &SqliteStore,
    id: &str,
) -> StorageOutcome<Option<WorkspaceRecord>> {
    let rows = match store
        .query("workspaces.select", params(vec![text(id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteWorkspaceRow>(rows, "workspaces", "workspaces.select") {
        StorageOutcome::Ok(Some(row)) => match workspace_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("workspaces.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        lkjstr_storage::StorageOperation::Read,
        "workspaces",
        "corrupt",
        operation_id,
    ))
}
