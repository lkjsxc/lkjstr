use lkjstr_app::FeedFooterState;

#[derive(Clone, Copy)]
pub(crate) enum FooterAuthLabel {
    Account,
    Auth,
}

pub(crate) fn footer_state_text(
    state: FeedFooterState,
    auth_label: FooterAuthLabel,
) -> &'static str {
    match state {
        FeedFooterState::Loading => "Loading",
        FeedFooterState::CacheHit => "Cached rows",
        FeedFooterState::ReadingRelays => "Reading relays",
        FeedFooterState::Partial => "Partial",
        FeedFooterState::AuthRequired => auth_label_text(auth_label),
        FeedFooterState::RetryableFailure => "Retry available",
        FeedFooterState::ConfigurationUnavailable => "Configuration unavailable",
        FeedFooterState::TerminalEmpty => "No rows",
        FeedFooterState::TerminalWithRows => "Rows loaded",
        FeedFooterState::OlderLoadReady => "Older rows available",
    }
}

fn auth_label_text(auth_label: FooterAuthLabel) -> &'static str {
    match auth_label {
        FooterAuthLabel::Account => "Account required",
        FooterAuthLabel::Auth => "Auth required",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn footer_text_names_shared_states() {
        let text = |state| footer_state_text(state, FooterAuthLabel::Account);
        assert_eq!(text(FeedFooterState::CacheHit), "Cached rows");
        assert_eq!(
            text(FeedFooterState::ConfigurationUnavailable),
            "Configuration unavailable"
        );
        assert_eq!(
            text(FeedFooterState::OlderLoadReady),
            "Older rows available"
        );
    }

    #[test]
    fn footer_text_preserves_surface_auth_copy() {
        assert_eq!(
            footer_state_text(FeedFooterState::AuthRequired, FooterAuthLabel::Account),
            "Account required"
        );
        assert_eq!(
            footer_state_text(FeedFooterState::AuthRequired, FooterAuthLabel::Auth),
            "Auth required"
        );
    }
}
