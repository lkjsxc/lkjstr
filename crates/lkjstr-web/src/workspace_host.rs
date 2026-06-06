use lkjstr_app::{StartupInput, default_recovery_ids};
use lkjstr_storage::{StorageOutcome, WorkspaceRecord};

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_tab_states_for_workspace, sqlite_workspace_get, sqlite_workspace_put},
};

pub async fn workspace_startup_input(db_name: &str, worker_url: &str, now: u64) -> StartupInput {
    match load_workspace(db_name, worker_url).await {
        StorageOutcome::Ok(stored_workspace) => {
            let tab_snapshots =
                startup_tab_snapshots(db_name, worker_url, stored_workspace.as_ref()).await;
            StartupInput {
                stored_workspace,
                storage_available: true,
                tab_snapshots,
                recovery_ids: default_recovery_ids("main"),
                now,
            }
        }
        _ => fallback_startup(now),
    }
}

pub async fn workspace_put(
    db_name: &str,
    worker_url: &str,
    row: &WorkspaceRecord,
) -> StorageOutcome<()> {
    with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_workspace_put(&store, row).await
    })
    .await
}

async fn load_workspace(
    db_name: &str,
    worker_url: &str,
) -> StorageOutcome<Option<WorkspaceRecord>> {
    with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_workspace_get(&store, "main").await
    })
    .await
}

async fn startup_tab_snapshots(
    db_name: &str,
    worker_url: &str,
    workspace: Option<&WorkspaceRecord>,
) -> Vec<lkjstr_storage::TabStateRecord> {
    let Some(workspace) = workspace else {
        return Vec::new();
    };
    match with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_tab_states_for_workspace(&store, &workspace.id).await
    })
    .await
    {
        StorageOutcome::Ok(rows) => rows,
        _ => Vec::new(),
    }
}

fn fallback_startup(now: u64) -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: false,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now,
    }
}
