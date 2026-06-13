use lkjstr_app::{GlobalFeedView, HomeFeedView, ProfileFeedView, ThreadFeedView};
use lkjstr_domain::TabKind;

use crate::app::RuntimeSignal;
use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::author_context_provider::AuthorContextFeedProvider;
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
use crate::workspace::thread_provider::ThreadFeedProvider;
use crate::workspace::tweet_provider::TweetProvider;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;
use crate::workspace::user_timeline_provider::UserTimelineProvider;

pub(crate) struct TabContentInput {
    pub(crate) runtime: RuntimeSignal,
    pub(crate) sequence: TabSequence,
    pub(crate) pane_id: String,
    pub(crate) tab_id: String,
    pub(crate) kind: TabKind,
    pub(crate) persistence: Option<WorkspacePersistence>,
    pub(crate) accounts_provider: Option<AccountsProvider>,
    pub(crate) relay_settings_provider: Option<RelaySettingsProvider>,
    pub(crate) stats_provider: Option<StatsProvider>,
    pub(crate) log_provider: Option<LogProvider>,
    pub(crate) settings_provider: Option<SettingsProvider>,
    pub(crate) upload_settings_provider: Option<UploadSettingsProvider>,
    pub(crate) tweet_provider: Option<TweetProvider>,
    pub(crate) home_feed_provider: Option<HomeFeedProvider>,
    pub(crate) followees_provider: Option<FolloweesProvider>,
    pub(crate) global_feed_provider: Option<GlobalFeedProvider>,
    pub(crate) search_feed_provider: Option<SearchFeedProvider>,
    pub(crate) notifications_feed_provider: Option<NotificationsFeedProvider>,
    pub(crate) profile_feed_provider: Option<ProfileFeedProvider>,
    pub(crate) author_context_feed_provider: Option<AuthorContextFeedProvider>,
    pub(crate) profile_copy_provider: Option<ProfileCopyProvider>,
    pub(crate) profile_follow_provider: Option<ProfileFollowProvider>,
    pub(crate) thread_feed_provider: Option<ThreadFeedProvider>,
    pub(crate) user_timeline_provider: Option<UserTimelineProvider>,
    pub(crate) active_account_pubkey: Option<String>,
    pub(crate) home_feed: Option<HomeFeedView>,
    pub(crate) global_feed: Option<GlobalFeedView>,
    pub(crate) profile_feed: Option<ProfileFeedView>,
    pub(crate) thread_feed: Option<ThreadFeedView>,
    pub(crate) profile_pubkey: Option<String>,
    pub(crate) thread_event_id: Option<String>,
    pub(crate) author_context_event_id: Option<String>,
    pub(crate) author_context_pubkey: Option<String>,
}
