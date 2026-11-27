pub use super::publish_types::{Draft, Emoji, LongForm, Mention, Publish, Uploaded};
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(tag = "a", rename_all = "camelCase")]
pub enum Action {
    #[serde(rename = "note.reveal")]
    NoteReveal {
        sub: String,
        key: String,
        reveal: bool,
    },
    #[serde(rename = "link.check")]
    LinkCheck {
        route: String,
        #[serde(rename = "ref")]
        reference: String,
    },
    #[serde(rename = "client.info")]
    ClientInfo { address: String },
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
    Pin {
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
