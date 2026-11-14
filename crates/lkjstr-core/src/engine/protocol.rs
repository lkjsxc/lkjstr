//! Structured-clone contract. Keep transport serialization at the host boundary.
use super::rows::Row;
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent};
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Input {
    Open {
        sub: String,
        query: Query,
    },
    Close {
        sub: String,
    },
    Window {
        sub: String,
        anchor: Option<String>,
        before: usize,
        after: usize,
    },
    Action {
        req: String,
        account: String,
        action: Action,
    },
    Signed {
        req: String,
        event: Option<NostrEvent>,
        error: Option<String>,
    },
    Hint {
        #[serde(rename = "visibleSubs")]
        visible_subs: Vec<String>,
        #[serde(default, rename = "pageHidden")]
        page_hidden: bool,
        #[serde(default)]
        idle: bool,
        #[serde(default, rename = "saveData")]
        save_data: bool,
    },
    Configure {
        relays: Vec<String>,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub source: Source,
    pub account: Option<String>,
    pub target: Option<String>,
    #[serde(default)]
    pub filters: Filters,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Home,
    #[default]
    Global,
    Profile,
    Thread,
    Notifications,
    Search,
    Hashtag,
    Bookmarks,
    List,
    Relay,
    Followers,
    Following,
    Mutes,
    Relays,
    Diagnostics,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Filters {
    pub authors: Option<Vec<String>>,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub types: Option<Vec<String>>,
    pub media: Option<bool>,
    pub replies: Option<bool>,
    pub reposts: Option<bool>,
    pub language: Option<String>,
    pub text: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Publish {
        kind: String,
        content: String,
        target: Option<String>,
        #[serde(default)]
        tags: Vec<Vec<String>>,
    },
    Follow {
        pubkey: String,
        value: bool,
    },
    Mute {
        kind: String,
        target: String,
        value: bool,
    },
    Bookmark {
        id: String,
        value: bool,
    },
    #[serde(rename = "profile.save")]
    ProfileSave {
        content: String,
    },
    #[serde(rename = "relays.save")]
    RelaysSave {
        relays: Vec<String>,
    },
    Upload {
        url: String,
        bytes: Vec<u8>,
        mime: String,
    },
}
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
    },
    Fresh {
        sub: String,
        count: usize,
    },
    Sign {
        req: String,
        event: UnsignedNostrEvent,
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delivery {
    pub relay: String,
    pub state: String,
    pub message: Option<String>,
}
