use leptos::prelude::*;
use lkjstr_app::{FeedViewRow, HomeFeedStatus, HomeFeedView, default_home_feed_view};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::feed_event_menu::event_row_with_nearby_menu;
use crate::workspace::feed_footer_row::state_footer;
use crate::workspace::feed_footer_text::FooterAuthLabel;
use crate::workspace::feed_state_row;
use crate::workspace::home_provider::HomeFeedProvider;

#[component]
pub fn HomeTab(
    owner: String,
    model: HomeFeedView,
    provider: Option<HomeFeedProvider>,
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    if let Some(provider) = provider {
        let lease = provider.read(owner, Callback::new(move |next| model.set(next)));
        on_cleanup(move || lease.release());
    }
    view! {
        <section class="lkjstr-home-feed" aria-label="Home">
            <p class="lkjstr-feed-status">{move || home_status_text(model.get().status)}</p>
            <div class="lkjstr-feed-rows">
                {move || {
                    let actions = actions.clone();
                    model
                        .get()
                        .view_model
                        .rows
                        .into_iter()
                        .map(move |row| home_row(row, actions.clone()))
                        .collect_view()
                }}
            </div>
        </section>
    }
}

#[must_use]
pub fn default_home_feed(tab_id: &str, active_pubkey: Option<String>) -> HomeFeedView {
    default_home_feed_view(tab_id, active_pubkey)
}

fn home_row(row: FeedViewRow, actions: FeedEventActions) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row_with_nearby_menu(
            row,
            actions,
            "home-open-author-context",
            "home-copy-event-id",
        )
        .into_any(),
        FeedViewRow::Unavailable(row) => feed_state_row::unavailable(row).into_any(),
        FeedViewRow::Diagnostic(row) => feed_state_row::diagnostic(row).into_any(),
        FeedViewRow::Continuation(row) => feed_state_row::plain_continuation(row).into_any(),
        FeedViewRow::Footer(row) => {
            state_footer(row.row_id, row.state, FooterAuthLabel::Account).into_any()
        }
        FeedViewRow::Profile(row) => feed_state_row::profile(row).into_any(),
        FeedViewRow::Notification(row) => feed_state_row::notification(row).into_any(),
    }
}

fn home_status_text(status: HomeFeedStatus) -> &'static str {
    match status {
        HomeFeedStatus::NoActiveAccount => "No active account",
        HomeFeedStatus::LoadingFollows => "Loading follows",
        HomeFeedStatus::LoadingFeed => "Home loading",
        HomeFeedStatus::NoEnabledRelay => "No enabled relay",
        HomeFeedStatus::NoFollowList => "No follow list",
        HomeFeedStatus::Ready => "Home ready",
        HomeFeedStatus::Partial => "Home partial",
        HomeFeedStatus::Unavailable => "Home unavailable",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::feed_footer_text::footer_state_text;
    use lkjstr_app::FeedFooterState;

    #[test]
    fn home_status_text_names_explicit_states() {
        assert_eq!(
            home_status_text(HomeFeedStatus::NoActiveAccount),
            "No active account"
        );
        assert_eq!(
            home_status_text(HomeFeedStatus::LoadingFeed),
            "Home loading"
        );
        assert_eq!(home_status_text(HomeFeedStatus::Partial), "Home partial");
    }

    #[test]
    fn home_footer_text_names_cache_and_unavailable_states() {
        let text = |state| footer_state_text(state, FooterAuthLabel::Account);
        assert_eq!(text(FeedFooterState::CacheHit), "Cached rows");
        assert_eq!(
            text(FeedFooterState::ConfigurationUnavailable),
            "Configuration unavailable"
        );
    }
}
