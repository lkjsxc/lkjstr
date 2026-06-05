use lkjstr_domain::TabKind;

pub(crate) const fn tab_kind_attr(kind: TabKind) -> &'static str {
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
