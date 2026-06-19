use leptos::prelude::*;
use lkjstr_app::{UserTimelineFeedStatus, UserTimelineFeedView, default_user_timeline_feed_view};

use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::user_timeline_actions::UserTimelineActions;
use crate::workspace::user_timeline_provider::UserTimelineProvider;
use crate::workspace::user_timeline_row::timeline_row;

#[component]
pub fn UserTimelineTab(
    owner: String,
    target_pubkey: Option<String>,
    model: UserTimelineFeedView,
    provider: Option<UserTimelineProvider>,
    actions: UserTimelineActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    if let Some(provider) = provider {
        let lease = provider.read(
            owner,
            target_pubkey.clone(),
            Callback::new(move |next| model.set(next)),
        );
        on_cleanup(move || lease.release());
    }
    view! {
        <section class="feed-tab lkjstr-user-timeline-feed" aria-label="User Timeline">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner user-timeline-list-scroll" data-scroll-owner="">
                    <header class="profile-card" data-testid="rust-user-timeline-header">
                        <div class="profile-card__main">
                            <div class="profile-card__identity">
                                <h2>"User Timeline"</h2>
                                <p>{move || user_timeline_header_mode(model.get())}</p>
                                {target_profile_button(target_pubkey.clone(), actions.open_profile)}
                            </div>
                        </div>
                    </header>
                    <p class="lkjstr-feed-status">{move || user_timeline_status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let actions = actions.clone();
                            model
                                .get()
                                .view_model
                                .rows
                                .into_iter()
                                .map(move |row| timeline_row(row, actions.clone()))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

pub fn user_timeline_tab_content(
    tab_id: String,
    target_pubkey: Option<String>,
    provider: Option<UserTimelineProvider>,
    copy_event_id: Option<ProfileCopyProvider>,
) -> impl IntoView {
    let model = default_user_timeline_feed_view(&tab_id, target_pubkey.clone());
    view! {
        <UserTimelineTab
            owner=tab_id
            target_pubkey=target_pubkey
            model=model
            provider=provider
            actions=UserTimelineActions {
                copy_event_id,
                ..UserTimelineActions::default()
            }
        />
    }
}

fn target_profile_button(
    target_pubkey: Option<String>,
    open_profile: Option<Callback<String>>,
) -> impl IntoView {
    target_pubkey.and_then(|pubkey| {
        open_profile.map(|open| {
            let run = move |_| open.run(pubkey.clone());
            view! {
                <button type="button" data-testid="user-timeline-open-target-profile" on:click=run>
                    "Open profile"
                </button>
            }
        })
    })
}

fn user_timeline_header_mode(model: UserTimelineFeedView) -> &'static str {
    match model.status {
        UserTimelineFeedStatus::TargetPostsOnly => "Target posts only",
        UserTimelineFeedStatus::LoadingFeed => {
            match model.author_set.as_ref().map(|set| set.mode.as_str()) {
                Some("target_posts_only") => "Target posts only",
                Some("follow_graph") => "Follow graph",
                _ => "Viewed profile",
            }
        }
        UserTimelineFeedStatus::Ready | UserTimelineFeedStatus::Partial => "Follow graph",
        _ => "Viewed profile",
    }
}

fn user_timeline_status_text(status: UserTimelineFeedStatus) -> &'static str {
    match status {
        UserTimelineFeedStatus::MissingPubkey => "User Timeline target unavailable.",
        UserTimelineFeedStatus::LoadingDiscovery => "Loading public timeline...",
        UserTimelineFeedStatus::LoadingFeed => "User Timeline loading.",
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
            user_timeline_status_text(UserTimelineFeedStatus::LoadingFeed),
            "User Timeline loading."
        );
        assert_eq!(
            user_timeline_status_text(UserTimelineFeedStatus::TargetPostsOnly),
            "Target posts only."
        );
    }
}
