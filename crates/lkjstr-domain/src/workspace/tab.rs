#![doc = "Workspace tabs."]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum TabKind {
    Welcome,
    NewTab,
    Timeline,
    Global,
    PublicChat,
    Notifications,
    Profile,
    ProfileEdit,
    UploadSettings,
    AccountManager,
    NpubMiner,
    Thread,
    RelayMonitor,
    RelaySettings,
    NetworkStats,
    Search,
    CustomRequest,
    AuthorContext,
    Tweet,
    Settings,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTab {
    pub id: String,
    pub kind: TabKind,
    pub title: String,
    pub icon: String,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub config: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub state: BTreeMap<String, String>,
    pub created_at: u64,
    pub updated_at: u64,
}

impl WorkspaceTab {
    #[must_use]
    pub fn new(id: impl Into<String>, kind: TabKind, now: u64) -> Self {
        let title = title_for(kind).to_owned();
        let icon = icon_for(kind).to_owned();
        Self {
            id: id.into(),
            kind,
            title,
            icon,
            config: BTreeMap::new(),
            state: BTreeMap::new(),
            created_at: now,
            updated_at: now,
        }
    }

    #[must_use]
    pub fn with_config(mut self, config: BTreeMap<String, String>, now: u64) -> Self {
        self.config = config;
        self.updated_at = now;
        self
    }
}

#[must_use]
pub const fn title_for(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "Welcome",
        TabKind::NewTab => "New Tab",
        TabKind::Timeline => "Home",
        TabKind::Global => "Global",
        TabKind::PublicChat => "Public Chat",
        TabKind::Notifications => "Notifications",
        TabKind::Profile => "Profile",
        TabKind::ProfileEdit => "Profile Edit",
        TabKind::UploadSettings => "Upload Settings",
        TabKind::AccountManager => "Accounts",
        TabKind::NpubMiner => "Mine npub",
        TabKind::Thread => "Thread",
        TabKind::RelayMonitor => "lkjstr Log",
        TabKind::RelaySettings => "Relay Settings",
        TabKind::NetworkStats => "Stats",
        TabKind::Search => "Search",
        TabKind::CustomRequest => "Custom Request",
        TabKind::AuthorContext => "Author Context",
        TabKind::Tweet => "Tweet",
        TabKind::Settings => "Settings",
    }
}

#[must_use]
pub const fn tab_kind_key(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "welcome",
        TabKind::NewTab => "new-tab",
        TabKind::Timeline => "timeline",
        TabKind::Global => "global",
        TabKind::PublicChat => "public-chat",
        TabKind::Notifications => "notifications",
        TabKind::Profile => "profile",
        TabKind::ProfileEdit => "profile-edit",
        TabKind::UploadSettings => "upload-settings",
        TabKind::AccountManager => "account-manager",
        TabKind::NpubMiner => "npub-miner",
        TabKind::Thread => "thread",
        TabKind::RelayMonitor => "relay-monitor",
        TabKind::RelaySettings => "relay-settings",
        TabKind::NetworkStats => "network-stats",
        TabKind::Search => "search",
        TabKind::CustomRequest => "custom-request",
        TabKind::AuthorContext => "author-context",
        TabKind::Tweet => "tweet",
        TabKind::Settings => "settings",
    }
}

#[must_use]
pub const fn icon_for(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "star",
        TabKind::NewTab => "plus",
        TabKind::Timeline => "list",
        TabKind::Global => "globe",
        TabKind::PublicChat => "message",
        TabKind::Notifications => "bell",
        TabKind::Profile => "user",
        TabKind::ProfileEdit => "id-card",
        TabKind::UploadSettings => "upload",
        TabKind::AccountManager => "users",
        TabKind::NpubMiner => "pickaxe",
        TabKind::Thread => "message",
        TabKind::RelayMonitor => "radio",
        TabKind::RelaySettings => "sliders",
        TabKind::NetworkStats => "activity",
        TabKind::Search => "search",
        TabKind::CustomRequest => "braces",
        TabKind::AuthorContext => "user-round-search",
        TabKind::Tweet => "edit",
        TabKind::Settings => "settings",
    }
}
