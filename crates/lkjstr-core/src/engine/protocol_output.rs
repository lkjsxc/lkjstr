use super::Delivery;
use crate::engine::rows::Row;
use lkjstr_protocol::UnsignedNostrEvent;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Output {
    Rows {
        sub: String,
        items: Vec<Row>,
        #[serde(rename = "atTop")]
        at_top: bool,
        #[serde(rename = "atBottom")]
        at_bottom: bool,
    },
    Patch {
        sub: String,
        ops: Vec<Patch>,
        // Final raw membership. A retained row can move without changing its model.
        order: Vec<String>,
    },
    Fresh {
        sub: String,
        count: usize,
        #[serde(default, rename = "ownHead")]
        own_head: bool,
    },
    TimeWindow {
        sub: String,
        at: u64,
        key: Option<String>,
        newer: TimeEdge,
        older: TimeEdge,
        follow_list: Option<FollowList>,
    },
    Sign {
        req: String,
        event: UnsignedNostrEvent,
    },
    PublishSigned {
        req: String,
        id: String,
    },
    PublishFallback {
        req: String,
    },
    Delivery {
        req: String,
        deliveries: Vec<Delivery>,
    },
    Result {
        req: String,
        id: Option<String>,
        deliveries: Vec<Delivery>,
        error: Option<String>,
    },
    Status {
        sub: String,
        state: String,
        #[serde(rename = "askedRelays")]
        asked_relays: usize,
        answered_relays: usize,
    },
    Visibility {
        sub: String,
        invalid_deliveries: u64,
        unavailable_reposts: usize,
    },
    Diagnostics {
        sub: String,
        data: serde_json::Value,
    },
    Error {
        req: Option<String>,
        code: String,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Patch {
    Upsert { index: usize, item: Box<Row> },
    Remove { id: String },
}
/// Public kind-3 provenance of an author's current follow selection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum FollowList {
    Unknown,
    LatestVerified { at: u64, id: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TimeEdge {
    CacheOnly,
    Unsupported,
    Loading,
    Partial,
    Stalled,
    End,
}
