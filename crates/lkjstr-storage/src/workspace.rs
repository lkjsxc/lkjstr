#![doc = "Workspace storage row helpers."]

use lkjstr_domain::Workspace;

pub type WorkspaceRecord = Workspace;

#[must_use]
pub fn workspace_record_id(row: &WorkspaceRecord) -> &str {
    &row.id
}

pub fn workspace_record_json_bytes(row: &WorkspaceRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}
