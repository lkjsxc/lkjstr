use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RelayPurpose {
    User,
    Discovery,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RelayConnectionState {
    Idle,
    Connecting,
    Open,
    Closed,
    Error,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayHealth {
    pub attempts: u32,
    pub successes: u32,
    pub failures: u32,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayRecord {
    pub url: String,
    pub label: String,
    pub enabled: bool,
    pub read: bool,
    pub write: bool,
    pub state: RelayConnectionState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<u64>,
    pub updated_at: u64,
    pub health: RelayHealth,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelaySet {
    pub id: String,
    pub name: String,
    pub purpose: RelayPurpose,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    pub seeded: bool,
    pub relays: Vec<RelayRecord>,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayPatch {
    Label(String),
    Enabled(bool),
    Read(bool),
    Write(bool),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RelaySetError {
    InvalidUrl,
    SetNotFound,
    NotUserSet,
}
