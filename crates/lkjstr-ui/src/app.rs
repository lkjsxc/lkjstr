use leptos::prelude::*;
use lkjstr_app::{StartupInput, WorkspaceRuntimeState, default_recovery_ids, start_workspace};

use crate::workspace::{
    AccountsProvider, RelaySettingsProvider, SettingsProvider, StatsProvider, TweetProvider,
    UploadSettingsProvider, WorkspacePersistence, WorkspaceShell,
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
    #[prop(optional)] settings_provider: Option<SettingsProvider>,
    #[prop(optional)] upload_settings_provider: Option<UploadSettingsProvider>,
    #[prop(optional)] tweet_provider: Option<TweetProvider>,
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
            settings_provider=settings_provider
            upload_settings_provider=upload_settings_provider
            tweet_provider=tweet_provider
        />
    }
}

pub type RuntimeSignal = RwSignal<WorkspaceRuntimeState>;

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
