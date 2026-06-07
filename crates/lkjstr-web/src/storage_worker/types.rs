use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SqlScalar {
    Text(String),
    Integer(i64),
    Float(f64),
    Null,
}

pub type SqlParams = Vec<SqlScalar>;
pub type SqlRow = BTreeMap<String, serde_json::Value>;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BatchMode {
    Readwrite,
    Readonly,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDatabase {
    pub database_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_vfs: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub allow_sahpool: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub allow_transient: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SqlStep {
    pub statement: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<SqlParams>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum StorageOp {
    Open {
        database: OpenDatabase,
    },
    Close,
    ApplySchema {
        #[serde(rename = "schemaHash")]
        schema_hash: String,
        statements: Vec<String>,
    },
    Execute {
        statement: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        params: Option<SqlParams>,
    },
    Query {
        statement: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        params: Option<SqlParams>,
        #[serde(rename = "rowLimit")]
        row_limit: u32,
    },
    GetStorageHealth,
    ReadPhysicalInventory,
    Batch {
        mode: BatchMode,
        steps: Vec<SqlStep>,
    },
    EstimateStorage,
    Cancel {
        #[serde(rename = "targetRequestId")]
        target_request_id: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageRequest {
    pub request_id: String,
    pub deadline_ms: u32,
    pub op: StorageOp,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostics {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vfs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<lkjstr_storage::SqliteStorageHealth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_usage_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_quota_bytes: Option<u64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorkerOutcome {
    Ok,
    Unavailable,
    Timeout,
    Busy,
    Blocked,
    Quota,
    Corrupt,
    Canceled,
    LateSettled,
    LateRejected,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageResponse {
    pub request_id: String,
    pub outcome: WorkerOutcome,
    #[serde(default)]
    pub rows: Vec<SqlRow>,
    #[serde(default)]
    pub rows_affected: u32,
    #[serde(default)]
    pub diagnostics: StorageDiagnostics,
}

fn is_false(value: &bool) -> bool {
    !*value
}
