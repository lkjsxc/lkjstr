use crate::workspace::{
    AccountsProvider, FolloweesProvider, GlobalFeedProvider, HomeFeedProvider, LogProvider,
    NotificationsFeedProvider, ProfileCopyProvider, ProfileFeedProvider, ProfileFollowProvider,
    RelaySettingsProvider, SearchFeedProvider, SettingsProvider, StatsProvider, ThreadFeedProvider,
    TweetProvider, UploadSettingsProvider, UserTimelineProvider, WorkspacePersistence,
};

#[derive(Clone)]
pub struct HostProviders {
    pub persistence: WorkspacePersistence,
    pub accounts: AccountsProvider,
    pub relay_settings: RelaySettingsProvider,
    pub stats: StatsProvider,
    pub log: LogProvider,
    pub settings: SettingsProvider,
    pub upload_settings: UploadSettingsProvider,
    pub tweet: TweetProvider,
    pub home_feed: HomeFeedProvider,
    pub followees: FolloweesProvider,
    pub global_feed: GlobalFeedProvider,
    pub search_feed: SearchFeedProvider,
    pub notifications_feed: NotificationsFeedProvider,
    pub profile_feed: ProfileFeedProvider,
    pub profile_copy: ProfileCopyProvider,
    pub profile_follow: ProfileFollowProvider,
    pub thread_feed: ThreadFeedProvider,
    pub user_timeline: UserTimelineProvider,
    pub active_account_pubkey: Option<String>,
}
