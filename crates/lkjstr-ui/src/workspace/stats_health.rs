use leptos::prelude::*;
use lkjstr_storage::{SqliteStorageHealth, StorageStatsSnapshot};

pub(crate) fn storage_health_rows(snapshot: Option<StorageStatsSnapshot>) -> impl IntoView {
    match snapshot {
        Some(snapshot) => rows_for_snapshot(snapshot).into_any(),
        None => view! {
            <tr><th>"Status"</th><td>"loading"</td></tr>
        }
        .into_any(),
    }
}

fn rows_for_snapshot(snapshot: StorageStatsSnapshot) -> impl IntoView {
    let status = snapshot.storage_health_status;
    match snapshot.storage_health {
        Some(health) => health_rows(status, health).into_any(),
        None => {
            let reason = snapshot
                .storage_health_reason
                .unwrap_or_else(|| "unavailable".to_string());
            view! {
                <tr><th>"Status"</th><td>{status}</td></tr>
                <tr><th>"Reason"</th><td>{reason}</td></tr>
            }
            .into_any()
        }
    }
}

fn health_rows(status: String, health: SqliteStorageHealth) -> impl IntoView {
    let schema_changes = health.applied_schema_changes.len();
    let warnings = warning_rows(&health);
    view! {
        <tr><th>"Status"</th><td>{status}</td></tr>
        <tr><th>"VFS"</th><td>{health.vfs_name}</td></tr>
        <tr><th>"Worker"</th><td>{health.worker_kind}</td></tr>
        <tr><th>"SQLite"</th><td>{health.sqlite_version}</td></tr>
        <tr><th>"Database"</th><td>{health.database_name}</td></tr>
        <tr><th>"Pages"</th><td>{format!("{} x {}", health.page_count, health.page_size)}</td></tr>
        <tr><th>"Freelist pages"</th><td>{health.freelist_count}</td></tr>
        <tr><th>"Events"</th><td>{health.event_count}</td></tr>
        <tr><th>"Relay receipts"</th><td>{health.relay_receipt_count}</td></tr>
        <tr><th>"Tag rows"</th><td>{health.tag_row_count}</td></tr>
        <tr><th>"Schema changes"</th><td>{schema_changes}</td></tr>
        <tr><th>"Warnings"</th><td>{warnings}</td></tr>
    }
}

fn warning_rows(health: &SqliteStorageHealth) -> String {
    if health.mode == "temporary-memory" && health.warnings.is_empty() {
        return "Temporary memory mode: changes may disappear when the browser session ends."
            .to_string();
    }
    if health.warnings.is_empty() {
        return "none".to_string();
    }
    health.warnings.join("; ")
}
