use serde::Deserialize;
#[derive(Deserialize)]
#[serde(tag = "a", rename_all = "camelCase")]
pub enum Action {
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
    Seen {
        #[serde(rename = "as")]
        account: String,
    },
    #[serde(rename = "account.add")]
    AccountAdd { how: String, key: Option<String> },
    #[serde(rename = "account.key")]
    AccountKey { pubkey: String },
    #[serde(rename = "account.use")]
    AccountUse { pubkey: String },
    #[serde(rename = "account.remove")]
    AccountRemove { pubkey: String },
    // ArrayBuffer bytes are intentionally not deserialized into JSON or logged.
    Upload {
        #[serde(rename = "as")]
        account: String,
        name: String,
        mime: String,
        #[serde(skip)]
        bytes: Vec<u8>,
    },
}
#[derive(Debug, Deserialize)]
#[serde(tag = "k", rename_all = "camelCase")]
pub enum Publish {
    Note {
        draft: Draft,
    },
    Repost {
        id: String,
    },
    Reaction {
        id: String,
        emoji: String,
        url: Option<String>,
    },
    Delete {
        id: String,
        of: Option<String>,
        emoji: Option<String>,
    },
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub text: String,
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
