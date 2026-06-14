use leptos::prelude::*;
use lkjstr_app::{GlobalFeedView, HomeFeedView, ProfileFeedView, ThreadFeedView};
use lkjstr_domain::TabKind;

use crate::app::RuntimeSignal;
use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::author_context_provider::AuthorContextFeedProvider;
use crate::workspace::custom_request_provider::CustomRequestProvider;
use crate::workspace::followees_provider::FolloweesProvider;
use crate::workspace::global_provider::GlobalFeedProvider;
use crate::workspace::home_provider::HomeFeedProvider;
use crate::workspace::log_provider::LogProvider;
use crate::workspace::notifications_provider::NotificationsFeedProvider;
use crate::workspace::pane::PaneView;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::profile_follow_provider::ProfileFollowProvider;
use crate::workspace::profile_provider::ProfileFeedProvider;
use crate::workspace::relay_settings_provider::RelaySettingsProvider;
use crate::workspace::search_provider::SearchFeedProvider;
use crate::workspace::settings_provider::SettingsProvider;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::thread_provider::ThreadFeedProvider;
use crate::workspace::tweet_provider::TweetProvider;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;
use crate::workspace::user_timeline_provider::UserTimelineProvider;

#[component]
pub fn WorkspaceShell(
    runtime: RuntimeSignal,
    persistence: Option<WorkspacePersistence>,
    accounts_provider: Option<AccountsProvider>,
    relay_settings_provider: Option<RelaySettingsProvider>,
    stats_provider: Option<StatsProvider>,
    log_provider: Option<LogProvider>,
    settings_provider: Option<SettingsProvider>,
    upload_settings_provider: Option<UploadSettingsProvider>,
    tweet_provider: Option<TweetProvider>,
    home_feed_provider: Option<HomeFeedProvider>,
    followees_provider: Option<FolloweesProvider>,
    global_feed_provider: Option<GlobalFeedProvider>,
    search_feed_provider: Option<SearchFeedProvider>,
    custom_request_provider: Option<CustomRequestProvider>,
    notifications_feed_provider: Option<NotificationsFeedProvider>,
    profile_feed_provider: Option<ProfileFeedProvider>,
    author_context_feed_provider: Option<AuthorContextFeedProvider>,
    profile_copy_provider: Option<ProfileCopyProvider>,
    profile_follow_provider: Option<ProfileFollowProvider>,
    thread_feed_provider: Option<ThreadFeedProvider>,
    user_timeline_provider: Option<UserTimelineProvider>,
    #[prop(default = None)] active_account_pubkey: Option<String>,
    #[prop(default = None)] home_feed: Option<HomeFeedView>,
    #[prop(default = None)] global_feed: Option<GlobalFeedView>,
    #[prop(default = None)] profile_feed: Option<ProfileFeedView>,
    #[prop(default = None)] thread_feed: Option<ThreadFeedView>,
) -> impl IntoView {
    let sequence: TabSequence = RwSignal::new(0_u64);
    let persistence_for_open = persistence.clone();
    let open_new_tab = move |_| {
        state::open_kind(
            runtime,
            sequence,
            None,
            TabKind::NewTab,
            persistence_for_open.clone(),
            1,
        );
    };

    view! {
        <main class="lkjstr-shell" data-testid="rust-workspace-shell">
            <header class="lkjstr-activity-bar">
                <strong>"lkjstr"</strong>
                <button type="button" on:click=open_new_tab aria-label="New tab">"+"</button>
            </header>
            <section class="lkjstr-pane-grid">
                {move || state::pane_ids(runtime).into_iter().map(|pane| {
                    view! {
                        <PaneView
                            runtime=runtime
                            sequence=sequence
                            pane=pane
                            persistence=persistence.clone()
                            accounts_provider=accounts_provider.clone()
                            relay_settings_provider=relay_settings_provider.clone()
                            stats_provider=stats_provider.clone()
                            log_provider=log_provider.clone()
                            settings_provider=settings_provider.clone()
                            upload_settings_provider=upload_settings_provider.clone()
                            tweet_provider=tweet_provider.clone()
                            home_feed_provider=home_feed_provider.clone()
                            followees_provider=followees_provider.clone()
                            global_feed_provider=global_feed_provider.clone()
                            search_feed_provider=search_feed_provider.clone()
                            custom_request_provider=custom_request_provider.clone()
                            notifications_feed_provider=notifications_feed_provider.clone()
                            profile_feed_provider=profile_feed_provider.clone()
                            author_context_feed_provider=author_context_feed_provider.clone()
                            profile_copy_provider=profile_copy_provider.clone()
                            profile_follow_provider=profile_follow_provider.clone()
                            thread_feed_provider=thread_feed_provider.clone()
                            user_timeline_provider=user_timeline_provider.clone()
                            active_account_pubkey=active_account_pubkey.clone()
                            home_feed=home_feed.clone()
                            global_feed=global_feed.clone()
                            profile_feed=profile_feed.clone()
                            thread_feed=thread_feed.clone()
                        />
                    }
                }).collect_view()}
            </section>
        </main>
    }
}
