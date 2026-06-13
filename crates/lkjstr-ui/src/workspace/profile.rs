use leptos::prelude::*;
use lkjstr_app::{
    FeedEventRow, FeedFooterState, FeedViewRow, ProfileFeedStatus, ProfileFeedView,
    default_profile_feed_view,
};

use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::profile_follow_provider::ProfileFollowProvider;
use crate::workspace::profile_header::profile_header;
use crate::workspace::profile_provider::ProfileFeedProvider;

#[derive(Clone)]
pub(crate) struct ProfileActions {
    pub(crate) active_account_pubkey: Option<String>,
    pub(crate) open_followees: Option<Callback<String>>,
    pub(crate) open_user_timeline: Option<Callback<String>>,
    pub(crate) open_profile_edit: Option<Callback<()>>,
    pub(crate) copy_profile: Option<ProfileCopyProvider>,
    pub(crate) follow_profile: Option<ProfileFollowProvider>,
}

#[component]
pub fn ProfileTab(
    owner: String,
    profile_pubkey: Option<String>,
    model: ProfileFeedView,
    provider: Option<ProfileFeedProvider>,
    actions: ProfileActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    if let Some(provider) = provider {
        let lease = provider.read(
            owner,
            profile_pubkey,
            Callback::new(move |next| model.set(next)),
        );
        on_cleanup(move || lease.release());
    }
    view! {
        <section class="lkjstr-profile-feed" aria-label="Profile">
            {move || {
                let actions = actions.clone();
                model
                    .get()
                    .profile_header
                    .into_iter()
                    .map(move |header| {
                        profile_header(
                            header,
                            actions.active_account_pubkey.clone(),
                            actions.open_followees,
                            actions.open_user_timeline,
                            actions.open_profile_edit,
                            actions.copy_profile.clone(),
                            actions.follow_profile.clone(),
                        )
                    })
                    .collect_view()
            }}
            <p class="lkjstr-feed-status">{move || profile_status_text(model.get().status)}</p>
            <div class="lkjstr-feed-rows">
                {move || model.get().view_model.rows.into_iter().map(profile_row).collect_view()}
            </div>
        </section>
    }
}

pub fn profile_tab_content(
    tab_id: String,
    profile_pubkey: Option<String>,
    profile_feed: Option<ProfileFeedView>,
    provider: Option<ProfileFeedProvider>,
    actions: ProfileActions,
) -> impl IntoView {
    let model =
        profile_feed.unwrap_or_else(|| default_profile_feed_view(&tab_id, profile_pubkey.clone()));
    view! {
        <ProfileTab
            owner=tab_id
            profile_pubkey=profile_pubkey
            model=model
            provider=provider
            actions=actions
        />
    }
}

fn profile_row(row: FeedViewRow) -> impl IntoView {
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

fn event_row(row: FeedEventRow) -> impl IntoView {
    let event_id = row.event_id.clone();
    let row_id = row.row_id.clone();
    let created_at = row.created_at;
    let text_rows = event_text(row);
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
            <small>{format!("created {created_at}")}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
        </article>
    }
}

fn event_text(row: FeedEventRow) -> Vec<String> {
    row.visual_rows
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
        .collect()
}

fn profile_status_text(status: ProfileFeedStatus) -> &'static str {
    match status {
        ProfileFeedStatus::MissingPubkey => "Profile unavailable",
        ProfileFeedStatus::NoEnabledRelay => "No enabled relay",
        ProfileFeedStatus::Ready => "Profile ready",
        ProfileFeedStatus::Partial => "Profile partial",
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
    fn profile_status_text_names_explicit_states() {
        let text = profile_status_text;
        assert_eq!(
            text(ProfileFeedStatus::MissingPubkey),
            "Profile unavailable"
        );
        assert_eq!(text(ProfileFeedStatus::Partial), "Profile partial");
    }
}
