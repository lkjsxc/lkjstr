use leptos::prelude::*;
use lkjstr_app::{
    GlobalFeedView, HomeFeedView, ProfileFeedView, StartupInput, ThreadFeedView,
    WorkspaceRuntimeState, default_recovery_ids, start_workspace,
};

use crate::workspace::{
    AccountsProvider, FolloweesProvider, GlobalFeedProvider, HomeFeedProvider, LogProvider,
    NotificationsFeedProvider, ProfileCopyProvider, ProfileFeedProvider, ProfileFollowProvider,
    RelaySettingsProvider, SearchFeedProvider, SettingsProvider, StatsProvider, ThreadFeedProvider,
    TweetProvider, UploadSettingsProvider, UserTimelineProvider, WorkspacePersistence,
    WorkspaceShell,
};

#[component]
pub fn App() -> impl IntoView {
    view! { <AppWithStartup startup=default_startup_input() /> }
}

#[component]
pub fn AppWithStartup(
    startup: StartupInput,
    #[prop(optional)] persistence: Option<WorkspacePersistence>,
    #[prop(optional)] accounts_provider: Option<AccountsProvider>,
    #[prop(optional)] relay_settings_provider: Option<RelaySettingsProvider>,
    #[prop(optional)] stats_provider: Option<StatsProvider>,
    #[prop(optional)] log_provider: Option<LogProvider>,
    #[prop(optional)] settings_provider: Option<SettingsProvider>,
    #[prop(optional)] upload_settings_provider: Option<UploadSettingsProvider>,
    #[prop(optional)] tweet_provider: Option<TweetProvider>,
    #[prop(optional)] home_feed_provider: Option<HomeFeedProvider>,
    #[prop(optional)] followees_provider: Option<FolloweesProvider>,
    #[prop(optional)] global_feed_provider: Option<GlobalFeedProvider>,
    #[prop(optional)] search_feed_provider: Option<SearchFeedProvider>,
    #[prop(optional)] notifications_feed_provider: Option<NotificationsFeedProvider>,
    #[prop(optional)] profile_feed_provider: Option<ProfileFeedProvider>,
    #[prop(optional)] profile_copy_provider: Option<ProfileCopyProvider>,
    #[prop(optional)] profile_follow_provider: Option<ProfileFollowProvider>,
    #[prop(optional)] thread_feed_provider: Option<ThreadFeedProvider>,
    #[prop(optional)] user_timeline_provider: Option<UserTimelineProvider>,
    #[prop(default = None)] active_account_pubkey: Option<String>,
    #[prop(default = None)] home_feed: Option<HomeFeedView>,
    #[prop(default = None)] global_feed: Option<GlobalFeedView>,
    #[prop(default = None)] profile_feed: Option<ProfileFeedView>,
    #[prop(default = None)] thread_feed: Option<ThreadFeedView>,
) -> impl IntoView {
    let startup = start_workspace(startup);
    let runtime = RwSignal::new(startup.state);

    view! {
        <WorkspaceShell
            runtime=runtime
            persistence=persistence
            accounts_provider=accounts_provider
            relay_settings_provider=relay_settings_provider
            stats_provider=stats_provider
            log_provider=log_provider
            settings_provider=settings_provider
            upload_settings_provider=upload_settings_provider
            tweet_provider=tweet_provider
            home_feed_provider=home_feed_provider
            followees_provider=followees_provider
            global_feed_provider=global_feed_provider
            search_feed_provider=search_feed_provider
            notifications_feed_provider=notifications_feed_provider
            profile_feed_provider=profile_feed_provider
            profile_copy_provider=profile_copy_provider
            profile_follow_provider=profile_follow_provider
            thread_feed_provider=thread_feed_provider
            user_timeline_provider=user_timeline_provider
            active_account_pubkey=active_account_pubkey
            home_feed=home_feed
            global_feed=global_feed
            profile_feed=profile_feed
            thread_feed=thread_feed
        />
    }
}

pub type RuntimeSignal = RwSignal<WorkspaceRuntimeState>;

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_profile_feed_and_followees_provider(
    startup: StartupInput,
    active_account_pubkey: String,
    profile_feed: ProfileFeedView,
    followees_provider: FolloweesProvider,
    profile_copy_provider: ProfileCopyProvider,
    profile_follow_provider: ProfileFollowProvider,
) {
    let user_timeline_provider = UserTimelineProvider::new(|request| {
        request.complete(lkjstr_app::default_user_timeline_feed_view(
            &request.owner,
            request.target_pubkey.clone(),
        ));
    });
    mount_app_with_profile_feed_followees_and_user_timeline_provider(
        startup,
        active_account_pubkey,
        profile_feed,
        followees_provider,
        user_timeline_provider,
        profile_copy_provider,
        profile_follow_provider,
    );
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_profile_feed_followees_and_user_timeline_provider(
    startup: StartupInput,
    active_account_pubkey: String,
    profile_feed: ProfileFeedView,
    followees_provider: FolloweesProvider,
    user_timeline_provider: UserTimelineProvider,
    profile_copy_provider: ProfileCopyProvider,
    profile_follow_provider: ProfileFollowProvider,
) {
    leptos::mount::mount_to_body(move || {
        view! {
            <AppWithStartup
                startup=startup.clone()
                active_account_pubkey=Some(active_account_pubkey.clone())
                profile_feed=Some(profile_feed.clone())
                followees_provider=followees_provider.clone()
                user_timeline_provider=user_timeline_provider.clone()
                profile_copy_provider=profile_copy_provider.clone()
                profile_follow_provider=profile_follow_provider.clone()
            />
        }
    });
}

#[must_use]
pub fn default_startup_input() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}
