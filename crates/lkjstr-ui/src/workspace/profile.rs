use leptos::prelude::*;
use lkjstr_app::{FeedViewRow, ProfileFeedStatus, ProfileFeedView, default_profile_feed_view};

use crate::workspace::feed_event_row::event_row;
use crate::workspace::feed_footer_text::{FooterAuthLabel, footer_state_text};
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
        FeedViewRow::Event(row) => event_row(row, ()).into_any(),
        FeedViewRow::Unavailable(row) => feed_state_row::unavailable(row).into_any(),
        FeedViewRow::Diagnostic(row) => feed_state_row::diagnostic(row).into_any(),
        FeedViewRow::Continuation(row) => feed_state_row::plain_continuation(row).into_any(),
        FeedViewRow::Footer(row) => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row.row_id>
                {footer_state_text(row.state, FooterAuthLabel::Account)}
            </footer>
        }
        .into_any(),
        FeedViewRow::Profile(row) => feed_state_row::profile(row).into_any(),
        FeedViewRow::Notification(row) => feed_state_row::notification(row).into_any(),
    }
}

fn profile_status_text(status: ProfileFeedStatus) -> &'static str {
    match status {
        ProfileFeedStatus::MissingPubkey => "Profile unavailable",
        ProfileFeedStatus::NoEnabledRelay => "No enabled relay",
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
        assert_eq!(text(ProfileFeedStatus::Partial), "Profile partial");
    }
}
