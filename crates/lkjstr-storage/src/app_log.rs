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

const SENSITIVE_MARKERS: &[&str] = &[
    "nsec",
    "private",
    "secret",
    "signer",
    "token",
    "authorization",
];

#[must_use]
pub fn redact_app_log_text(value: &str) -> String {
    let lower = value.to_ascii_lowercase();
    if SENSITIVE_MARKERS
        .iter()
        .any(|marker| lower.contains(marker))
    {
        return "[redacted]".to_string();
    }
    value.to_string()
}
