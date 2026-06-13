use leptos::prelude::*;
use lkjstr_domain::TabKind;

use crate::workspace::accounts::AccountsTab;
use crate::workspace::author_context::author_context_tab_content;
use crate::workspace::followees::followees_tab_content;
use crate::workspace::global::{GlobalTab, default_global_feed};
use crate::workspace::home::{HomeTab, default_home_feed};
use crate::workspace::log::LogTab;
use crate::workspace::menu::NewTabMenu;
use crate::workspace::notifications::{NotificationsTab, default_notifications_feed};
use crate::workspace::profile_open::profile_tab_content;
use crate::workspace::public_chat::EmptyPublicChatTab;
use crate::workspace::relay_settings::RelaySettingsTab;
use crate::workspace::search::{SearchTab, default_search_feed};
use crate::workspace::search_snapshot::SearchSnapshotHandle;
use crate::workspace::settings::SettingsTab;
use crate::workspace::stats::StatsTab;
use crate::workspace::tab_content_input::TabContentInput;
use crate::workspace::tab_pending::pending_message;
use crate::workspace::thread_open::thread_tab_content;
use crate::workspace::tweet::TweetTab;
use crate::workspace::upload_settings::UploadSettingsTab;
use crate::workspace::user_timeline::user_timeline_tab_content;
use crate::workspace::welcome::WelcomeTab;

pub(crate) fn tab_content(input: TabContentInput) -> impl IntoView {
    match input.kind {
        TabKind::Welcome => view! {
            <WelcomeTab
                runtime=input.runtime
                sequence=input.sequence
                pane_id=input.pane_id
                persistence=input.persistence
            />
        }
        .into_any(),
        TabKind::NewTab => view! {
            <NewTabMenu
                runtime=input.runtime
                sequence=input.sequence
                pane_id=input.pane_id
                tab_id=Some(input.tab_id)
                active_account_pubkey=input.active_account_pubkey.clone()
                persistence=input.persistence
            />
        }
        .into_any(),
        TabKind::NetworkStats => view! {
            <StatsTab runtime=input.runtime provider=input.stats_provider />
        }
        .into_any(),
        TabKind::RelayMonitor => view! {
            <LogTab provider=input.log_provider />
        }
        .into_any(),
        TabKind::PublicChat => view! { <EmptyPublicChatTab /> }.into_any(),
        TabKind::Timeline => {
            let model = input
                .home_feed
                .unwrap_or_else(|| default_home_feed(&input.tab_id, input.active_account_pubkey));
            view! {
                <HomeTab owner=input.tab_id model=model provider=input.home_feed_provider />
            }
            .into_any()
        }
        TabKind::Global => {
            let model = input
                .global_feed
                .unwrap_or_else(|| default_global_feed(&input.tab_id));
            view! {
                <GlobalTab owner=input.tab_id model=model provider=input.global_feed_provider />
            }
            .into_any()
        }
        TabKind::Search => {
            let owner = input.tab_id;
            let model = default_search_feed(&owner);
            let snapshot = SearchSnapshotHandle::new(
                input.runtime,
                input.pane_id,
                owner.clone(),
                input.persistence.clone(),
            );
            view! {
                <SearchTab
                    owner=owner
                    model=model
                    provider=input.search_feed_provider
                    snapshot=snapshot
                />
            }
            .into_any()
        }
        TabKind::Profile => profile_tab_content(input).into_any(),
        TabKind::AuthorContext => author_context_tab_content(
            input.tab_id,
            input.author_context_event_id,
            input.author_context_pubkey,
            input.author_context_feed_provider,
        )
        .into_any(),
        TabKind::Followees => {
            followees_tab_content(input.tab_id, input.profile_pubkey, input.followees_provider)
                .into_any()
        }
        TabKind::UserTimeline => user_timeline_tab_content(
            input.tab_id,
            input.profile_pubkey,
            input.user_timeline_provider,
        )
        .into_any(),
        TabKind::Thread => thread_tab_content(input).into_any(),
        TabKind::Notifications => {
            let model = default_notifications_feed(&input.tab_id, input.active_account_pubkey);
            view! {
                <NotificationsTab
                    owner=input.tab_id
                    model=model
                    provider=input.notifications_feed_provider
                />
            }
            .into_any()
        }
        TabKind::AccountManager => {
            view! { <AccountsTab provider=input.accounts_provider /> }.into_any()
        }
        TabKind::RelaySettings => view! {
            <RelaySettingsTab provider=input.relay_settings_provider />
        }
        .into_any(),
        TabKind::Settings => view! { <SettingsTab provider=input.settings_provider /> }.into_any(),
        TabKind::UploadSettings => view! {
            <UploadSettingsTab provider=input.upload_settings_provider />
        }
        .into_any(),
        TabKind::Tweet => view! {
            <TweetTab tab_id=input.tab_id provider=input.tweet_provider />
        }
        .into_any(),
        _ => view! {
            <div class="lkjstr-pending-surface">
                <p>{pending_message(input.kind)}</p>
            </div>
        }
        .into_any(),
    }
}
