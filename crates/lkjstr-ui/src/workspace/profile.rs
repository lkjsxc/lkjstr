use leptos::prelude::*;
use lkjstr_app::{FeedViewRow, ProfileFeedStatus, ProfileFeedView, default_profile_feed_view};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::feed_event_menu::event_row_with_nearby_menu;
use crate::workspace::feed_footer_row::state_footer;
use crate::workspace::feed_footer_text::FooterAuthLabel;
use crate::workspace::feed_state_row;
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
    pub(crate) event_actions: FeedEventActions,
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
    let header_actions = actions.clone();
    let row_actions = actions.event_actions.clone();
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
                let actions = header_actions.clone();
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
                {move || {
                    let event_actions = row_actions.clone();
                    model
                        .get()
                        .view_model
                        .rows
                        .into_iter()
                        .map(move |row| profile_row(row, event_actions.clone()))
                        .collect_view()
                }}
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

fn profile_row(row: FeedViewRow, actions: FeedEventActions) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row_with_nearby_menu(
            row,
            actions,
            "profile-open-author-context",
            "profile-copy-event-id",
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

fn profile_status_text(status: ProfileFeedStatus) -> &'static str {
    match status {
        ProfileFeedStatus::MissingPubkey => "Profile unavailable",
        ProfileFeedStatus::NoEnabledRelay => "No enabled relay",
        ProfileFeedStatus::Loading => "Profile loading",
        ProfileFeedStatus::Ready => "Profile ready",
        ProfileFeedStatus::Partial => "Profile partial",
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
        assert_eq!(text(ProfileFeedStatus::Loading), "Profile loading");
        assert_eq!(text(ProfileFeedStatus::Partial), "Profile partial");
    }
}
