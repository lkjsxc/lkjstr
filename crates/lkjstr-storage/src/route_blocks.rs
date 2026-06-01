#![doc = "Protected relay route-block SQLite rows."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RelayRouteBlockRecord {
    pub relay_url: String,
    pub pubkey: String,
    pub reason: String,
    pub created_at_ms: u64,
}

pub type SqliteRelayRouteBlockRow = RelayRouteBlockRecord;
