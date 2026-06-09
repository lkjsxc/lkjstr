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
            let reason = health_problem_reason(snapshot.storage_health_reason);
            view! {
                <tr><th>"Status"</th><td>{status}</td></tr>
                <tr><th>"Reason"</th><td>{reason}</td></tr>
            }
            .into_any()
        }
    }
}

fn health_problem_reason(reason: Option<String>) -> String {
    reason.unwrap_or_else(|| "unavailable".to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_problem_reason_keeps_exact_states() {
        for reason in [
            "unavailable",
            "timeout",
            "blocked",
            "corrupt",
            "unknown-old-storage",
        ] {
            let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
                .with_storage_health_problem(reason);

            assert_eq!(snapshot.storage_health_status, reason);
            assert_eq!(
                health_problem_reason(snapshot.storage_health_reason),
                reason
            );
        }
    }

    #[test]
    fn temporary_memory_health_warns_without_loading_copy() {
        let health = SqliteStorageHealth {
            mode: "temporary-memory".to_string(),
            vfs_name: "memory".to_string(),
            worker_kind: "dedicated".to_string(),
            sqlite_version: "3.test".to_string(),
            database_name: ":memory:".to_string(),
            applied_schema_changes: Vec::new(),
            page_count: 1,
            page_size: 4096,
            freelist_count: 0,
            event_count: 0,
            relay_receipt_count: 0,
            tag_row_count: 0,
            last_integrity_check_at: None,
            warnings: Vec::new(),
        };

        assert_eq!(
            warning_rows(&health),
            "Temporary memory mode: changes may disappear when the browser session ends."
        );
    }
}
