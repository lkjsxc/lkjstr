#![doc = "Storage inventory row records."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageTableCount {
    pub table: String,
    pub row_count: Option<u64>,
    pub problem_reason: Option<String>,
}

impl StorageTableCount {
    #[must_use]
    pub fn available(table: impl Into<String>, row_count: u64) -> Self {
        Self {
            table: table.into(),
            row_count: Some(row_count),
            problem_reason: None,
        }
    }

    #[must_use]
    pub fn unavailable(table: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            table: table.into(),
            row_count: None,
            problem_reason: Some(reason.into()),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageInventoryRow {
    pub table: String,
    pub data_class: String,
    pub group: String,
    pub status: String,
    pub row_count: Option<u64>,
    pub problem_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteRowCount {
    pub row_count: u64,
}
