#![doc = "Workspace storage row helpers."]

use lkjstr_domain::Workspace;
use serde::{Deserialize, Serialize};

pub type WorkspaceRecord = Workspace;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteWorkspaceRow {
    pub workspace_id: String,
    pub layout_json: String,
    pub active_pane_id: Option<String>,
    pub active_tab_id: Option<String>,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn workspace_record_id(row: &WorkspaceRecord) -> &str {
    &row.id
}

pub fn workspace_record_json_bytes(row: &WorkspaceRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_workspace_row(
    row: &WorkspaceRecord,
) -> Result<SqliteWorkspaceRow, serde_json::Error> {
    Ok(SqliteWorkspaceRow {
        workspace_id: row.id.clone(),
        layout_json: serde_json::to_string(row)?,
        active_pane_id: row.focused_pane_id.clone(),
        active_tab_id: row.focused_tab_id.clone(),
        created_at_ms: row.updated_at,
        updated_at_ms: row.updated_at,
    })
}

pub fn workspace_from_sqlite_row(
    row: &SqliteWorkspaceRow,
) -> Result<WorkspaceRecord, serde_json::Error> {
    serde_json::from_str(&row.layout_json)
}
