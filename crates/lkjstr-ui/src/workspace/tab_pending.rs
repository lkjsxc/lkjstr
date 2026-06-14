use lkjstr_domain::TabKind;

pub(crate) fn pending_message(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Timeline => "The Rust Home body is waiting for feed data.",
        TabKind::Global => "The Rust Global body is waiting for feed data.",
        TabKind::PublicChat => "The Rust Public Chat body is loading real state.",
        TabKind::Notifications => "The Rust Notifications body is waiting for feed data.",
        TabKind::Profile => "The Rust Profile body needs a profile target.",
        TabKind::Followees => "The Rust Followees body needs a profile target.",
        TabKind::UserTimeline => "The Rust User Timeline body needs a profile target.",
        TabKind::ProfileEdit => "The Rust Profile Edit body is not converted yet.",
        TabKind::UploadSettings => "",
        TabKind::AccountManager => "",
        TabKind::NpubMiner => "The Rust Mine npub body is not converted yet.",
        TabKind::Thread => "The Rust Thread body needs an event target.",
        TabKind::RelayMonitor => "",
        TabKind::RelaySettings => "",
        TabKind::NetworkStats => "",
        TabKind::Search => "",
        TabKind::CustomRequest => "The Rust Custom Request body is waiting for a request.",
        TabKind::AuthorContext => "The Rust Author Context body needs an event and author.",
        TabKind::Tweet => "",
        TabKind::Settings => "",
        TabKind::Welcome | TabKind::NewTab => "",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converted_surfaces_do_not_claim_unconverted_pending_state() {
        for kind in [
            TabKind::Global,
            TabKind::Notifications,
            TabKind::Profile,
            TabKind::Followees,
            TabKind::UserTimeline,
            TabKind::Thread,
            TabKind::CustomRequest,
            TabKind::AuthorContext,
        ] {
            assert!(!pending_message(kind).contains("not converted yet"));
        }
    }
}
