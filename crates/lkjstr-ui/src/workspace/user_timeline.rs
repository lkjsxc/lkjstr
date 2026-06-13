use leptos::prelude::*;
use lkjstr_app::{
    FeedEventRow, FeedFooterState, FeedViewRow, UserTimelineFeedStatus, UserTimelineFeedView,
    default_user_timeline_feed_view,
};

use crate::workspace::user_timeline_provider::UserTimelineProvider;

#[component]
pub fn UserTimelineTab(
    owner: String,
    target_pubkey: Option<String>,
    model: UserTimelineFeedView,
    provider: Option<UserTimelineProvider>,
) -> impl IntoView {
    let model = RwSignal::new(model);
    if let Some(provider) = provider {
        let lease = provider.read(
            owner,
            target_pubkey,
            Callback::new(move |next| model.set(next)),
        );
        on_cleanup(move || lease.release());
    }
    view! {
        <section class="lkjstr-user-timeline-feed" aria-label="User Timeline">
            <header class="profile-card" data-testid="rust-user-timeline-header">
                <div class="profile-card__main">
                    <div class="profile-card__identity">
                        <h2>"User Timeline"</h2>
                        <p>{move || user_timeline_header_mode(model.get())}</p>
                    </div>
                </div>
            </header>
            <p class="lkjstr-feed-status">{move || user_timeline_status_text(model.get().status)}</p>
            <div class="lkjstr-feed-rows">
                {move || model.get().view_model.rows.into_iter().map(timeline_row).collect_view()}
            </div>
        </section>
    }
}

pub fn user_timeline_tab_content(
    tab_id: String,
    target_pubkey: Option<String>,
    provider: Option<UserTimelineProvider>,
) -> impl IntoView {
    let model = default_user_timeline_feed_view(&tab_id, target_pubkey.clone());
    view! {
        <UserTimelineTab
            owner=tab_id
            target_pubkey=target_pubkey
            model=model
            provider=provider
        />
    }
}

fn timeline_row(row: FeedViewRow) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row).into_any(),
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
        FeedViewRow::Footer(row) => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row.row_id>
                {footer_state_text(row.state)}
            </footer>
        }
        .into_any(),
        FeedViewRow::Continuation(row) => view! {
            <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
                <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
            </article>
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

fn event_row(row: FeedEventRow) -> impl IntoView {
    let text_rows = row
        .visual_rows
        .into_iter()
        .filter_map(|item| match item {
            lkjstr_app::FeedVisualRow::EventFull(row) => Some(row.content),
            lkjstr_app::FeedVisualRow::EventTextSegment(row) => Some(row.text),
            lkjstr_app::FeedVisualRow::EventMediaSegment(row) => {
                Some(format!("media segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventReferenceSegment(row) => {
                Some(format!("reference segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventHeader(_)
            | lkjstr_app::FeedVisualRow::EventActions(_) => None,
        })
        .collect::<Vec<_>>();
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row.row_id data-event-id=row.event_id>
            <small>{format!("created {}", row.created_at)}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
        </article>
    }
}

fn user_timeline_header_mode(model: UserTimelineFeedView) -> &'static str {
    match model.status {
        UserTimelineFeedStatus::TargetPostsOnly => "Target posts only",
        UserTimelineFeedStatus::Ready | UserTimelineFeedStatus::Partial => "Follow graph",
        _ => "Viewed profile",
    }
}

fn user_timeline_status_text(status: UserTimelineFeedStatus) -> &'static str {
    match status {
        UserTimelineFeedStatus::MissingPubkey => "User Timeline target unavailable.",
        UserTimelineFeedStatus::LoadingDiscovery => "Loading public timeline...",
        UserTimelineFeedStatus::NoEnabledRelay => "User Timeline needs a relay.",
        UserTimelineFeedStatus::Ready => "User Timeline ready.",
        UserTimelineFeedStatus::TargetPostsOnly => "Target posts only.",
        UserTimelineFeedStatus::Partial => "User Timeline partial.",
        UserTimelineFeedStatus::Incomplete => "User Timeline discovery incomplete.",
        UserTimelineFeedStatus::Failed => "User Timeline discovery failed.",
        UserTimelineFeedStatus::AuthRequired => "User Timeline relay auth required.",
        UserTimelineFeedStatus::RateLimited => "User Timeline relays rate limited.",
        UserTimelineFeedStatus::Offline => "User Timeline offline.",
    }
}

fn footer_state_text(state: FeedFooterState) -> &'static str {
    match state {
        FeedFooterState::Loading => "Loading",
        FeedFooterState::CacheHit => "Cached rows",
        FeedFooterState::ReadingRelays => "Reading relays",
        FeedFooterState::Partial => "Partial",
        FeedFooterState::AuthRequired => "Auth required",
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
    fn status_text_names_explicit_states() {
        assert_eq!(
            user_timeline_status_text(UserTimelineFeedStatus::LoadingDiscovery),
            "Loading public timeline..."
        );
        assert_eq!(
            user_timeline_status_text(UserTimelineFeedStatus::TargetPostsOnly),
            "Target posts only."
        );
    }
}
