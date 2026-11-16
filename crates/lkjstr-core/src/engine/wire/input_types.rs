use super::{
    RelayConfig,
    actions::Action,
    queries::{Anchor, Config, Hint, Query},
};
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum Input {
    #[serde(rename = "dm.open")]
    DmOpen {
        sub: String,
        query: crate::engine::dm::Query,
    },
    #[serde(rename = "dm.close")]
    DmClose {
        sub: String,
    },
    #[serde(rename = "dm.visible")]
    DmVisible {
        sub: String,
        visible: bool,
    },
    #[serde(rename = "dm.more")]
    DmMore {
        sub: String,
    },
    Crypted {
        req: String,
        value: Option<String>,
        error: Option<String>,
    },
    Preview {
        sub: String,
        ids: Vec<String>,
    },
    Stats {
        req: String,
    },
    RowAtTime {
        req: String,
        sub: String,
        at: u64,
    },
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
        query: Box<Query>,
    },
    Close {
        sub: String,
    },
    Window {
        sub: String,
        anchor: Anchor,
        before: usize,
        after: usize,
        #[serde(default, rename = "retainAbove")]
        retain_above: bool,
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

impl std::fmt::Debug for Input {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Input [redacted]")
    }
}
