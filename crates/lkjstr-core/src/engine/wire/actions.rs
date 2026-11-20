use serde::Deserialize;
#[derive(Deserialize)]
#[serde(tag = "a", rename_all = "camelCase")]
pub enum Action {
    #[serde(rename = "zap.invoice")]
    ZapInvoice {
        #[serde(rename = "as")]
        account: String,
        intent: crate::engine::zaps::InvoiceInput,
    },
    #[serde(rename = "lists.retry")]
    ListsRetry {
        #[serde(rename = "as")]
        account: String,
    },
    #[serde(rename = "dm.editor")]
    DmEditor {
        #[serde(rename = "as")]
        account: String,
        editor: String,
        open: bool,
        dirty: Option<bool>,
    },
    #[serde(rename = "dm.draft.load")]
    DmDraftLoad {
        #[serde(rename = "as")]
        account: String,
        tab: String,
    },
    #[serde(rename = "dm.draft.save")]
    DmDraftSave {
        #[serde(rename = "as")]
        account: String,
        tab: String,
        state: crate::engine::dm::drafts::State,
        expected: Option<String>,
    },
    #[serde(rename = "dm.draft.clear")]
    DmDraftClear {
        #[serde(rename = "as")]
        account: String,
        tab: String,
        expected: Option<String>,
    },
    #[serde(rename = "dm.send")]
    DmSend {
        #[serde(rename = "as")]
        account: String,
        draft: crate::engine::dm::Draft,
    },
    #[serde(rename = "dm.seen")]
    DmSeen {
        #[serde(rename = "as")]
        account: String,
        conversation: String,
    },
    #[serde(rename = "dm.relays.save")]
    DmRelaysSave {
        #[serde(rename = "as")]
        account: String,
        relays: Vec<String>,
    },
    Publish {
        #[serde(rename = "as")]
        account: String,
        what: Publish,
    },
    Follow {
        #[serde(rename = "as")]
        account: String,
        pubkey: String,
        on: bool,
    },
    Mute {
        #[serde(rename = "as")]
        account: String,
        target: MuteTarget,
        on: bool,
    },
    Bookmark {
        #[serde(rename = "as")]
        account: String,
        id: String,
        on: bool,
    },
    #[serde(rename = "profile.save")]
    ProfileSave {
        #[serde(rename = "as")]
        account: String,
        profile: serde_json::Value,
    },
    #[serde(rename = "relays.save")]
    RelaysSave {
        #[serde(rename = "as")]
        account: String,
        relays: Vec<RelayEntry>,
    },
    #[serde(rename = "servers.save")]
    ServersSave {
        #[serde(rename = "as")]
        account: String,
        servers: Vec<String>,
    },
    #[serde(rename = "servers.check")]
    ServersCheck { server: String },
    #[serde(rename = "channel.join")]
    ChannelJoin {
        #[serde(rename = "as")]
        account: String,
        id: String,
        on: bool,
    },
    #[serde(rename = "channel.save")]
    ChannelSave {
        #[serde(rename = "as")]
        account: String,
        id: Option<String>,
        channel: serde_json::Value,
    },
    #[serde(rename = "channel.seen")]
    ChannelSeen {
        #[serde(rename = "as")]
        account: String,
        id: String,
    },
    Seen {
        #[serde(rename = "as")]
        account: String,
    },
    #[serde(rename = "account.add")]
    AccountAdd { how: String, key: Option<String> },
    #[serde(rename = "account.importEncrypted")]
    AccountImportEncrypted {
        key: String,
        password: crate::engine::accounts::secret::SecretText,
    },
    #[serde(rename = "account.unlock")]
    AccountUnlock {
        pubkey: String,
        password: crate::engine::accounts::secret::SecretText,
    },
    #[serde(rename = "account.lock")]
    AccountLock { pubkey: String },
    #[serde(rename = "account.exportEncrypted")]
    AccountExportEncrypted {
        pubkey: String,
        password: crate::engine::accounts::secret::SecretText,
        #[serde(rename = "logN")]
        log_n: Option<u8>,
    },
    #[serde(rename = "account.key")]
    AccountKey { pubkey: String },
    #[serde(rename = "account.use")]
    AccountUse { pubkey: String },
    #[serde(rename = "account.remove")]
    AccountRemove { pubkey: String },
    Upload {
        server: Option<String>,
        #[serde(rename = "as")]
        account: String,
        name: String,
        mime: String,
        #[serde(skip)] // ArrayBuffer bytes stay outside JSON and logs.
        bytes: Vec<u8>,
    },
}
#[derive(Debug, Deserialize)]
#[serde(tag = "k", rename_all = "camelCase")]
pub enum Publish {
    Note {
        draft: Box<Draft>,
    },
    Repost {
        id: String,
    },
    Reaction {
        id: String,
        emoji: String,
        url: Option<String>,
        address: Option<String>,
    },
    Delete {
        id: String,
        of: Option<String>,
        emoji: Option<String>,
        url: Option<String>,
    },
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    pub start: usize,
    pub end: usize,
    pub pubkey: String,
    pub label: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub mentions: Option<Vec<Mention>>,
    pub text: String,
    pub channel: Option<String>,
    pub long_form: Option<LongForm>,
    pub reply_to: Option<String>,
    pub quote: Option<String>,
    pub media: Option<Vec<Uploaded>>,
    pub cw: Option<String>,
    pub emoji: Option<Vec<Emoji>>,
}
#[derive(Debug, Deserialize)]
pub struct Uploaded {
    pub url: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub mime: String,
    pub w: Option<u32>,
    pub h: Option<u32>,
    pub sha256: Option<String>,
    pub alt: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct Emoji {
    pub code: String,
    pub url: String,
    pub address: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct RelayEntry {
    pub url: String,
    pub read: bool,
    pub write: bool,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "k", rename_all = "camelCase")]
pub enum MuteTarget {
    Person { pubkey: String },
    Word { word: String },
    Hashtag { tag: String },
    Thread { id: String },
}
impl std::fmt::Debug for Action {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Action [redacted]")
    }
}
#[derive(Debug, Deserialize)]
pub struct LongForm {
    pub identifier: String,
    pub title: Option<String>,
}
