use leptos::prelude::*;
use lkjstr_app::{GlobalFeedView, HomeFeedView, ProfileFeedView, ThreadFeedView};
use lkjstr_domain::WorkspaceTab;

use crate::app::RuntimeSignal;
use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::followees_provider::FolloweesProvider;
use crate::workspace::global_provider::GlobalFeedProvider;
use crate::workspace::home_provider::HomeFeedProvider;
use crate::workspace::log_provider::LogProvider;
use crate::workspace::notifications_provider::NotificationsFeedProvider;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::profile_follow_provider::ProfileFollowProvider;
use crate::workspace::profile_provider::ProfileFeedProvider;
use crate::workspace::relay_settings_provider::RelaySettingsProvider;
use crate::workspace::search_provider::SearchFeedProvider;
use crate::workspace::settings_provider::SettingsProvider;
use crate::workspace::state::TabSequence;
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::tab_content::tab_content;
use crate::workspace::tab_content_input::TabContentInput;
use crate::workspace::tab_kind_attr::tab_kind_attr;
use crate::workspace::thread_provider::ThreadFeedProvider;
use crate::workspace::tweet_provider::TweetProvider;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;
use crate::workspace::user_timeline_provider::UserTimelineProvider;

#[component]
pub fn TabBody(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab: WorkspaceTab,
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
    notifications_feed_provider: Option<NotificationsFeedProvider>,
    profile_feed_provider: Option<ProfileFeedProvider>,
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
    let kind = tab.kind;
    let tab_id = tab.id;
    let title = tab.title;
    let profile_pubkey = tab.config.get("pubkey").cloned();
    let thread_event_id = tab.config.get("eventId").cloned();
    let input = TabContentInput {
        runtime,
        sequence,
        pane_id,
        tab_id,
        kind,
        persistence,
        accounts_provider,
        relay_settings_provider,
        stats_provider,
        log_provider,
        settings_provider,
        upload_settings_provider,
        tweet_provider,
        home_feed_provider,
        followees_provider,
        global_feed_provider,
        search_feed_provider,
        notifications_feed_provider,
        profile_feed_provider,
        profile_copy_provider,
        profile_follow_provider,
        thread_feed_provider,
        user_timeline_provider,
        active_account_pubkey,
        home_feed,
        global_feed,
        profile_feed,
        thread_feed,
        profile_pubkey,
        thread_event_id,
    };
    view! {
        <div class="lkjstr-tab-body" data-tab-kind=tab_kind_attr(kind)>
            <h1>{title}</h1>
            {tab_content(input)}
        </div>
    }
}
