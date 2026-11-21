use super::{
    RelayConfig,
    actions::Action,
    queries::{Anchor, Config, Hint, Query},
};
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum Input {
    #[serde(rename = "cache.hold")]
    CacheHold {
        sub: String,
        rows: Vec<super::cache_hold::HeldRow>,
    },
    #[serde(rename = "storage.inspect")]
    StorageInspect {
        req: String,
    },
    #[serde(rename = "storage.close")]
    StorageClose {
        req: String,
    },
    #[serde(rename = "signer.auth.cancel")]
    SignerAuthCancel {
        id: String,
        reason: Option<String>,
    },
    #[serde(rename = "zap.quote")]
    ZapQuote {
        req: String,
        query: crate::engine::zaps::QuoteInput,
    },
    #[serde(rename = "zap.receipts")]
    ZapReceipts {
        req: String,
        query: crate::engine::zaps::ReceiptInput,
    },
    #[serde(rename = "zap.close")]
    ZapClose {
        req: String,
    },
    #[serde(rename = "dm.flushed")]
    DmFlushed {
        req: String,
        ok: bool,
    },
    #[serde(rename = "dm.open")]
    DmOpen {
        sub: String,
        query: crate::engine::dm::Query,
        visible: Option<bool>,
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
    #[serde(rename = "upload.cancel")]
    UploadCancel {
        req: String,
    },
    Reading {
        sub: String,
        key: Option<String>,
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
        #[serde(default)]
        account: Option<String>,
        #[serde(default)]
        cached: Option<super::WriteRelayList>,
        #[serde(default)]
        defaults: Option<Vec<String>>,
        #[serde(default, rename = "usesDefaults")]
        uses_defaults: bool,
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
        visible: Option<bool>,
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
        #[serde(default, rename = "liveAbove")]
        live_above: bool,
        #[serde(default, rename = "headThrough")]
        head_through: Option<String>,
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
