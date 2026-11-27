//! Structured-clone contract. Keep transport serialization at the host boundary.
#[path = "protocol_output.rs"]
mod output;
pub use output::{FollowList, Output, Patch, TimeEdge};
#[path = "protocol_delivery.rs"]
mod delivery;
pub use delivery::Delivery;
use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitialWindow {
    pub anchor: Option<String>,
    pub before: usize,
    pub after: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Input {
    DeliveryWatch {
        reqs: Vec<String>,
    },
    Open {
        sub: String,
        query: Query,
    },
    OpenVisible {
        sub: String,
        query: Query,
        visible: bool,
        window: Option<InitialWindow>,
    },
    Close {
        sub: String,
    },
    CacheRead {
        sub: String,
        ids: Vec<String>,
    },
    Reading {
        sub: String,
        id: Option<String>,
    },
    Window {
        sub: String,
        anchor: Option<String>,
        before: usize,
        after: usize,
    },
    WindowAtMonth {
        sub: String,
        anchor: Option<String>,
        month: u64,
        before: usize,
        after: usize,
    },
    FollowHead {
        sub: String,
        through: String,
        after: usize,
    },
    WindowAtTime {
        sub: String,
        at: u64,
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
    OptimizerHint(crate::optimizer::features::Interaction),
    LinkHint {
        hint: Option<crate::optimizer::link::Hint>,
    },
    Hint {
        #[serde(rename = "visibleSubs")]
        visible_subs: Vec<String>,
        #[serde(default, rename = "focusedSub")]
        focused_sub: Option<String>,
        #[serde(default, rename = "pageHidden")]
        page_hidden: bool,
        #[serde(default)]
        idle: bool,
        #[serde(default, rename = "saveData")]
        save_data: bool,
    },
    GlobalPolicy {
        enabled: bool,
    },
    Configure {
        relays: Vec<String>,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
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
    TheirHome,
    People,
    #[default]
    Global,
    Profile,
    Thread,
    Notifications,
    Search,
    Hashtag,
    Bookmarks,
    Pins,
    List,
    Relay,
    Followers,
    Following,
    Mutes,
    Relays,
    Diagnostics,
    MediaServers,
    Emoji,
    Channels,
    Channel,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
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
    pub languages: Option<Vec<String>>,
    pub text: Option<String>,
    pub phrases: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    pub has: Option<Vec<String>>,
    pub from: Option<Vec<String>>,
    pub notifications: Option<bool>,
    pub show: Option<String>,
    #[serde(default)]
    pub relay_hints: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayEntry {
    pub url: String,
    pub read: bool,
    pub write: bool,
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
    ChannelJoin {
        id: String,
        on: bool,
    },
    ChannelSave {
        id: Option<String>,
        channel: serde_json::Value,
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
    Pin {
        id: String,
        value: bool,
    },
    #[serde(rename = "profile.save")]
    ProfileSave {
        content: String,
    },
    #[serde(rename = "relays.save")]
    RelaysSave {
        relays: Vec<RelayEntry>,
    },
    ServersSave {
        servers: Vec<String>,
    },
    Upload {
        url: String,
        bytes: Vec<u8>,
        mime: String,
    },
}
