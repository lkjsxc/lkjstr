//! Mirrors web/next-20261114:web/src/engine/protocol.ts (authoritative).
pub mod actions;
mod counts;
mod note;
mod notifications;
mod output;
pub mod queries;
mod query_translate;
mod quote_state;
mod sources;
mod thread;
mod translate;
use actions::Action;
use queries::{Anchor, Config, Hint, Query};
use serde::{Deserialize, Serialize};
#[derive(Debug, Deserialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum Input {
    Configure {
        config: Config,
    },
    Relays {
        relays: Vec<RelayConfig>,
    },
    Heartbeat,
    Detach,
    PublicKey {
        req: String,
        pubkey: Option<String>,
        error: Option<String>,
    },
    Hint {
        hint: Hint,
    },
    Open {
        sub: String,
        query: Query,
    },
    Close {
        sub: String,
    },
    Window {
        sub: String,
        anchor: Anchor,
        before: usize,
        after: usize,
    },
    Act {
        req: String,
        action: Action,
    },
    Signed {
        req: String,
        event: Option<String>,
        error: Option<String>,
    },
}
#[derive(Debug, Serialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum Output {
    Heartbeat,
    GetPublicKey {
        req: String,
    },
    Reconnect,
    Progress {
        req: String,
        sent: usize,
        total: usize,
    },
    Ready {
        version: u32,
        engine: String,
    },
    Accounts {
        accounts: Vec<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        active: Option<String>,
    },
    Rows {
        sub: String,
        rows: Vec<serde_json::Value>,
        #[serde(rename = "atTop")]
        at_top: bool,
        #[serde(rename = "atBottom")]
        at_bottom: bool,
    },
    Patch {
        sub: String,
        ops: Vec<serde_json::Value>,
    },
    Fresh {
        sub: String,
        count: usize,
    },
    State {
        sub: String,
        state: serde_json::Value,
    },
    Sign {
        req: String,
        pubkey: String,
        event: String,
    },
    Delivery {
        req: String,
        relays: Vec<serde_json::Value>,
    },
    Result {
        req: String,
        ok: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<Failure>,
        #[serde(skip_serializing_if = "Option::is_none")]
        delivery: Option<Vec<serde_json::Value>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        uploaded: Option<serde_json::Value>,
    },
    Status {
        connected: usize,
        wanted: usize,
        offline: bool,
    },
}
#[derive(Debug, Serialize)]
pub struct Failure {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
/// Adapter state is per transport client; the engine remains independent of pixels.
#[derive(Default)]
pub struct Session {
    pub queries: std::collections::BTreeMap<String, Query>,
    pub config: Config,
    pub(super) windows: std::collections::BTreeMap<String, (Option<String>, usize, usize)>,
    pub(super) delivered: std::collections::BTreeMap<String, Vec<serde_json::Value>>,
}
impl Session {
    pub fn ready(shared: bool) -> Output {
        Output::Ready {
            version: 1,
            engine: if shared {
                "rust-wasm-shared"
            } else {
                "rust-wasm-worker"
            }
            .into(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayConfig {
    pub url: String,
    pub read: bool,
    pub write: bool,
    pub search: bool,
}
