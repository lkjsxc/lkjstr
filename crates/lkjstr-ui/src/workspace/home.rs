use leptos::prelude::*;
use lkjstr_app::{
    FeedFooterState, FeedViewRow, HomeFeedStatus, HomeFeedView, default_home_feed_view,
};

use crate::workspace::feed_event_row::event_row;
use crate::workspace::home_provider::HomeFeedProvider;

#[component]
pub fn HomeTab(
    owner: String,
    model: HomeFeedView,
    provider: Option<HomeFeedProvider>,
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
                {move || model.get().view_model.rows.into_iter().map(home_row).collect_view()}
            </div>
        </section>
    }
}

#[must_use]
pub fn default_home_feed(tab_id: &str, active_pubkey: Option<String>) -> HomeFeedView {
    default_home_feed_view(tab_id, active_pubkey)
}

fn home_row(row: FeedViewRow) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row, ()).into_any(),
        FeedViewRow::Unavailable(row) => view! {
            <article class="lkjstr-feed-row unavailable" data-row-id=row.row_id>
                <strong>{row.reason}</strong>
                <p>{row.detail}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Diagnostic(row) => view! {
            <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
                <strong>{format!("{:?}", row.severity)}</strong>
                <p>{row.message}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Continuation(row) => view! {
            <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
                <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Footer(row) => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row.row_id>
                {footer_state_text(row.state)}
            </footer>
        }
        .into_any(),
        FeedViewRow::Profile(row) => view! {
            <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
                <strong>{row.display_name}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Notification(row) => view! {
            <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
                <strong>{row.notification_kind}</strong>
            </article>
        }
        .into_any(),
    }
}

fn home_status_text(status: HomeFeedStatus) -> &'static str {
    match status {
        HomeFeedStatus::NoActiveAccount => "No active account",
        HomeFeedStatus::LoadingFollows => "Loading follows",
        HomeFeedStatus::NoEnabledRelay => "No enabled relay",
        HomeFeedStatus::NoFollowList => "No follow list",
        HomeFeedStatus::Ready => "Home ready",
        HomeFeedStatus::Partial => "Home partial",
        HomeFeedStatus::Unavailable => "Home unavailable",
    }
}

fn footer_state_text(state: FeedFooterState) -> &'static str {
    match state {
        FeedFooterState::Loading => "Loading",
        FeedFooterState::CacheHit => "Cached rows",
        FeedFooterState::ReadingRelays => "Reading relays",
        FeedFooterState::Partial => "Partial",
        FeedFooterState::AuthRequired => "Account required",
        FeedFooterState::RetryableFailure => "Retry available",
        FeedFooterState::ConfigurationUnavailable => "Configuration unavailable",
        FeedFooterState::TerminalEmpty => "No rows",
        FeedFooterState::TerminalWithRows => "Rows loaded",
        FeedFooterState::OlderLoadReady => "Older rows available",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn home_status_text_names_explicit_states() {
        assert_eq!(
            home_status_text(HomeFeedStatus::NoActiveAccount),
            "No active account"
        );
        assert_eq!(home_status_text(HomeFeedStatus::Partial), "Home partial");
    }

    #[test]
    fn home_footer_text_names_cache_and_unavailable_states() {
        assert_eq!(footer_state_text(FeedFooterState::CacheHit), "Cached rows");
        assert_eq!(
            footer_state_text(FeedFooterState::ConfigurationUnavailable),
            "Configuration unavailable"
        );
    }
}
