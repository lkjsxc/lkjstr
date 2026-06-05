use leptos::prelude::*;
use lkjstr_domain::{TabKind, WorkspaceTab, empty_public_chat_state};

use crate::app::RuntimeSignal;
use crate::workspace::accounts::AccountsTab;
use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::menu::NewTabMenu;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::public_chat::PublicChatTab;
use crate::workspace::relay_settings::RelaySettingsTab;
use crate::workspace::relay_settings_provider::RelaySettingsProvider;
use crate::workspace::settings::SettingsTab;
use crate::workspace::settings_provider::SettingsProvider;
use crate::workspace::state::TabSequence;
use crate::workspace::stats::StatsTab;
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::tab_kind_attr::tab_kind_attr;
use crate::workspace::tab_pending::pending_message;
use crate::workspace::tweet::TweetTab;
use crate::workspace::tweet_provider::TweetProvider;
use crate::workspace::upload_settings::UploadSettingsTab;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;
use crate::workspace::welcome::WelcomeTab;

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
    settings_provider: Option<SettingsProvider>,
    upload_settings_provider: Option<UploadSettingsProvider>,
    tweet_provider: Option<TweetProvider>,
) -> impl IntoView {
    let kind = tab.kind;
    let tab_id = tab.id;
    let title = tab.title;
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
        settings_provider,
        upload_settings_provider,
        tweet_provider,
    };
    view! {
        <div class="lkjstr-tab-body" data-tab-kind=tab_kind_attr(kind)>
            <h1>{title}</h1>
            {tab_content(input)}
        </div>
    }
}

struct TabContentInput {
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab_id: String,
    kind: TabKind,
    persistence: Option<WorkspacePersistence>,
    accounts_provider: Option<AccountsProvider>,
    relay_settings_provider: Option<RelaySettingsProvider>,
    stats_provider: Option<StatsProvider>,
    settings_provider: Option<SettingsProvider>,
    upload_settings_provider: Option<UploadSettingsProvider>,
    tweet_provider: Option<TweetProvider>,
}

fn tab_content(input: TabContentInput) -> impl IntoView {
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
                active_account_pubkey=None
                persistence=input.persistence
            />
        }
        .into_any(),
        TabKind::NetworkStats => view! {
            <StatsTab runtime=input.runtime provider=input.stats_provider />
        }
        .into_any(),
        TabKind::PublicChat => view! {
            <PublicChatTab
                state=empty_public_chat_state()
                read_relays=Vec::new()
                active_pubkey=None
            />
        }
        .into_any(),
        TabKind::AccountManager => view! {
            <AccountsTab provider=input.accounts_provider />
        }
        .into_any(),
        TabKind::RelaySettings => view! {
            <RelaySettingsTab provider=input.relay_settings_provider />
        }
        .into_any(),
        TabKind::Settings => view! {
            <SettingsTab provider=input.settings_provider />
        }
        .into_any(),
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
