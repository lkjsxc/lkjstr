use lkjstr_domain::TabKind;

pub(crate) fn pending_message(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Timeline => "The Rust Home body is not converted yet.",
        TabKind::Global => "The Rust Global body is not converted yet.",
        TabKind::PublicChat => "The Rust Public Chat body is loading real state.",
        TabKind::Notifications => "The Rust Notifications body is not converted yet.",
        TabKind::Profile => "The Rust Profile body is not converted yet.",
        TabKind::Followees => "The Rust Followees body is not converted yet.",
        TabKind::UserTimeline => "The Rust User Timeline body is not converted yet.",
        TabKind::ProfileEdit => "The Rust Profile Edit body is not converted yet.",
        TabKind::UploadSettings => "",
        TabKind::AccountManager => "",
        TabKind::NpubMiner => "The Rust Mine npub body is not converted yet.",
        TabKind::Thread => "The Rust Thread body is not converted yet.",
        TabKind::RelayMonitor => "",
        TabKind::RelaySettings => "",
        TabKind::NetworkStats => "",
        TabKind::Search => "The Rust Search body is not converted yet.",
        TabKind::CustomRequest => "The Rust Custom Request body is not converted yet.",
        TabKind::AuthorContext => "The Rust Author Context body is not converted yet.",
        TabKind::Tweet => "",
        TabKind::Settings => "",
        TabKind::Welcome | TabKind::NewTab => "",
    }
}
