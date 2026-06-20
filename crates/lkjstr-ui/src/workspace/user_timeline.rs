use leptos::prelude::*;
use lkjstr_app::{default_user_timeline_feed_view, UserTimelineFeedStatus, UserTimelineFeedView};

#[path = "user_timeline_read.rs"]
mod user_timeline_read;

use self::user_timeline_read::UserTimelineReadController;
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
    let read_controller = UserTimelineReadController::new();
    read_controller.read(
        provider,
        owner,
        target_pubkey.clone(),
        Callback::new(move |next| model.set(next)),
    );
    on_cleanup(move || read_controller.release());
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
                    <p class="lkjstr-feed-status">{move || user_timeline_status_text(model.get())}</p>
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

fn user_timeline_status_text(model: UserTimelineFeedView) -> String {
    model.status_detail
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_text_names_explicit_states() {
        let model = default_user_timeline_feed_view("tab-a", Some("a".repeat(64)));
        assert_eq!(
            user_timeline_status_text(model),
            "Loading public timeline..."
        );
        let mut model = default_user_timeline_feed_view("tab-a", Some("a".repeat(64)));
        model.status_detail = "Discovery incomplete: tried selected relays.".to_owned();
        assert_eq!(
            user_timeline_status_text(model),
            "Discovery incomplete: tried selected relays."
        );
    }
}
