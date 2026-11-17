use serde::Serialize;
#[derive(Serialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum Output {
    #[serde(rename = "cache.reconcile")]
    CacheReconcile {
        sub: String,
        #[serde(rename = "removedKeys")]
        removed_keys: Vec<String>,
        #[serde(rename = "invalidProfileIds")]
        invalid_profile_ids: Vec<String>,
        #[serde(rename = "removedQuoteIds")]
        removed_quote_ids: Vec<String>,
    },
    #[serde(rename = "cache.policy")]
    CachePolicy {
        sub: String,
        allow: bool,
    },
    Storage {
        req: String,
        report: crate::engine::storage_inspection::Report,
    },
    #[serde(rename = "signer.auth")]
    SignerAuth {
        id: String,
        peer: String,
        method: String,
        url: crate::engine::accounts::secret::SecretText,
        #[serde(rename = "expiresAt")]
        expires_at: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        account: Option<String>,
        #[serde(rename = "actionReq", skip_serializing_if = "Option::is_none")]
        action_req: Option<String>,
    },
    #[serde(rename = "signer.auth.clear")]
    SignerAuthClear {
        id: String,
    },
    #[serde(rename = "zap.quote")]
    ZapQuote {
        req: String,
        quote: crate::engine::zaps::Quote,
    },
    #[serde(rename = "zap.receipts")]
    ZapReceipts {
        req: String,
        page: crate::engine::zaps::ReceiptView,
    },
    #[serde(rename = "crypt.cancel")]
    CryptCancel {
        req: String,
    },
    #[serde(rename = "dm.flush")]
    DmFlush {
        req: String,
        account: String,
        phase: String,
    },
    Dm {
        sub: String,
        snapshot: crate::engine::dm::Snapshot,
    },
    Crypt {
        req: String,
        pubkey: String,
        peer: String,
        operation: String,
        data: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        context: Option<CryptContext>,
    },
    Timeline {
        sub: String,
        timeline: serde_json::Value,
    },
    Stats {
        req: String,
        stats: serde_json::Value,
    },
    RowAtTime {
        req: String,
        sub: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        at: Option<u64>,
        cached: bool,
    },
    Heartbeat,
    GetPublicKey {
        req: String,
    },
    Reconnect,
    Progress {
        #[serde(skip_serializing_if = "Option::is_none")]
        server: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        phase: Option<String>,
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
        #[serde(rename = "actionReq", skip_serializing_if = "Option::is_none")]
        action_req: Option<String>,
    },
    Delivery {
        req: String,
        relays: Vec<serde_json::Value>,
    },
    Result {
        req: String,
        ok: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        cancelled: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<Failure>,
        #[serde(skip_serializing_if = "Option::is_none")]
        delivery: Option<Vec<serde_json::Value>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        uploaded: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        #[serde(rename = "encryptedKey", skip_serializing_if = "Option::is_none")]
        encrypted_key: Option<String>,
        #[serde(rename = "zapIntent", skip_serializing_if = "Option::is_none")]
        zap_intent: Option<crate::engine::zaps::InvoiceBatch>,
        #[serde(rename = "dmDraft", skip_serializing_if = "Option::is_none")]
        dm_draft: Option<Box<crate::engine::dm::drafts::State>>,
        #[serde(rename = "dmDraftRevision", skip_serializing_if = "Option::is_none")]
        dm_draft_revision: Option<String>,
        #[serde(rename = "dmDelivery", skip_serializing_if = "Option::is_none")]
        dm_delivery: Option<crate::engine::dm::drafts::Delivery>,
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

impl std::fmt::Debug for Output {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Output [redacted]")
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum CryptContext {
    PrivateList { sub: String, event: String },
}
