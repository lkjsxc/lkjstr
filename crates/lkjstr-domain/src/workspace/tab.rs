#![doc = "Workspace tabs."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum TabKind {
    Welcome,
    NewTab,
    Timeline,
    Global,
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
            created_at: now,
            updated_at: now,
        }
    }
}

#[must_use]
pub const fn title_for(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "Welcome",
        TabKind::NewTab => "New Tab",
        TabKind::Timeline => "Home",
        TabKind::Global => "Global",
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
pub const fn icon_for(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "star",
        TabKind::NewTab => "plus",
        TabKind::Timeline => "list",
        TabKind::Global => "globe",
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
