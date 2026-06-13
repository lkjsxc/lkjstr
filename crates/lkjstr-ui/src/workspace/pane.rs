use leptos::prelude::*;
use lkjstr_app::{GlobalFeedView, HomeFeedView, ProfileFeedView, ThreadFeedView};
use lkjstr_domain::PaneNode;

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
use crate::workspace::state::{self, TabSequence};
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::tab_body::TabBody;
use crate::workspace::thread_provider::ThreadFeedProvider;
use crate::workspace::tweet_provider::TweetProvider;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;
use crate::workspace::user_timeline_provider::UserTimelineProvider;

#[component]
pub fn PaneView(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane: PaneNode,
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
    let pane_id = pane.id.clone();
    let pane_attr = pane.id.clone();
    let tabs_pane_id = pane.id.clone();
    let body_pane_id = pane.id;
    let tabs_persistence = persistence.clone();
    let body_persistence = persistence.clone();
    let body_accounts_provider = accounts_provider.clone();
    let body_relay_settings_provider = relay_settings_provider.clone();
    let body_stats_provider = stats_provider.clone();
    let body_log_provider = log_provider.clone();
    let body_settings_provider = settings_provider.clone();
    let body_upload_settings_provider = upload_settings_provider.clone();
    let body_tweet_provider = tweet_provider.clone();
    let body_home_feed_provider = home_feed_provider.clone();
    let body_followees_provider = followees_provider.clone();
    let body_global_feed_provider = global_feed_provider.clone();
    let body_search_feed_provider = search_feed_provider.clone();
    let body_notifications_feed_provider = notifications_feed_provider.clone();
    let body_profile_feed_provider = profile_feed_provider.clone();
    let body_author_context_feed_provider = author_context_feed_provider.clone();
    let body_profile_copy_provider = profile_copy_provider.clone();
    let body_profile_follow_provider = profile_follow_provider.clone();
    let body_thread_feed_provider = thread_feed_provider.clone();
    let body_user_timeline_provider = user_timeline_provider.clone();
    let body_active_account_pubkey = active_account_pubkey.clone();
    let body_home_feed = home_feed.clone();
    let body_global_feed = global_feed.clone();
    let body_profile_feed = profile_feed.clone();
    let body_thread_feed = thread_feed.clone();
    let title = move || state::active_title(runtime, &pane_id);

    view! {
        <article class="lkjstr-pane" data-pane-id=pane_attr>
            <div class="lkjstr-pane-head">
                <span class="lkjstr-pane-title">{title}</span>
                <button type="button" aria-label="Pane menu">"..."</button>
            </div>
            <nav class="lkjstr-tab-strip" aria-label="Tabs">
                {move || {
                    let pane_id = tabs_pane_id.clone();
                    let persistence = tabs_persistence.clone();
                    state::pane_tabs(runtime, &pane_id).into_iter().map(move |tab| {
                        let selected_tab_id = tab.id.clone();
                        let focus_tab_id = tab.id.clone();
                        let focus_pane_id = pane_id.clone();
                        let persistence_for_focus = persistence.clone();
                        let selected = move || state::is_focused(runtime, &selected_tab_id);
                        let focus = move |_| {
                            state::focus(
                                runtime,
                                focus_pane_id.clone(),
                                focus_tab_id.clone(),
                                persistence_for_focus.clone(),
                                1,
                            );
                        };
                        view! {
                            <button type="button" class:active=selected on:click=focus>
                                {tab.title}
                            </button>
                        }
                    }).collect_view()
                }}
            </nav>
            <section class="lkjstr-pane-body">
                {move || {
                    let pane_id = body_pane_id.clone();
                    let persistence = body_persistence.clone();
                    let accounts_provider = body_accounts_provider.clone();
                    let relay_settings_provider = body_relay_settings_provider.clone();
                    let stats_provider = body_stats_provider.clone();
                    let log_provider = body_log_provider.clone();
                    let settings_provider = body_settings_provider.clone();
                    let upload_settings_provider = body_upload_settings_provider.clone();
                    let tweet_provider = body_tweet_provider.clone();
                    let home_feed_provider = body_home_feed_provider.clone();
                    let followees_provider = body_followees_provider.clone();
                    let global_feed_provider = body_global_feed_provider.clone();
                    let search_feed_provider = body_search_feed_provider.clone();
                    let notifications_feed_provider = body_notifications_feed_provider.clone();
                    let profile_feed_provider = body_profile_feed_provider.clone();
                    let author_context_feed_provider = body_author_context_feed_provider.clone();
                    let profile_copy_provider = body_profile_copy_provider.clone();
                    let profile_follow_provider = body_profile_follow_provider.clone();
                    let thread_feed_provider = body_thread_feed_provider.clone();
                    let user_timeline_provider = body_user_timeline_provider.clone();
                    let active_account_pubkey = body_active_account_pubkey.clone();
                    let home_feed = body_home_feed.clone();
                    let global_feed = body_global_feed.clone();
                    let profile_feed = body_profile_feed.clone();
                    let thread_feed = body_thread_feed.clone();
                    state::active_tab(runtime, &pane_id).into_iter().map(move |tab| {
                        view! {
                            <TabBody
                                runtime=runtime
                                sequence=sequence
                                pane_id=pane_id.clone()
                                tab=tab
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
                    }).collect_view()
                }}
            </section>
        </article>
    }
}
