#![doc = "App log SQLite row codecs."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AppLogRecord {
    pub log_id: String,
    pub area: String,
    pub level: String,
    pub code: String,
    pub message: String,
    pub context_json: String,
    pub record_json: String,
    pub created_at_ms: u64,
}

pub type SqliteAppLogRow = AppLogRecord;
