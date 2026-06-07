#![doc = "Leptos UI components for lkjstr."]

mod app;
mod workspace;

pub use app::{App, AppWithStartup, default_startup_input};
pub use workspace::{
    AccountsCommand, AccountsComplete, AccountsProvider, AccountsResult, LogComplete, LogProvider,
    LogResult, RelaySettingsCommand, RelaySettingsComplete, RelaySettingsProvider,
    RelaySettingsResult, SettingsCommand, SettingsComplete, SettingsProvider, SettingsResult,
    StatsComplete, StatsProvider, TweetCommand, TweetComplete, TweetProvider, TweetResult,
    UploadSettingsCommand, UploadSettingsComplete, UploadSettingsProvider, UploadSettingsResult,
    WorkspacePersistence,
};
pub use workspace::{AccountsIdCommand, AccountsInputCommand};
pub use workspace::{
    RelayIdCommand, RelayInputCommand, RelayPatchCommand, RelayPurposeCommand, RelaySetIdCommand,
};
pub use workspace::{SettingsImportCommand, SettingsKeyCommand, SettingsValueCommand};
pub use workspace::{TweetDraftCommand, TweetIdCommand};
pub use workspace::{
    UploadBoolCommand, UploadDiscoverCommand, UploadProviderCommand, UploadTextCommand,
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
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app() {
    leptos::mount::mount_to_body(App);
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_startup(startup: lkjstr_app::StartupInput) {
    leptos::mount::mount_to_body(move || {
        leptos::view! { <AppWithStartup startup=startup.clone() /> }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_persistence(
    startup: lkjstr_app::StartupInput,
    persistence: WorkspacePersistence,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup startup=startup.clone() persistence=persistence.clone() />
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn mount_app_with_host(startup: lkjstr_app::StartupInput, providers: HostProviders) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                persistence=providers.persistence.clone()
                accounts_provider=providers.accounts.clone()
                relay_settings_provider=providers.relay_settings.clone()
                stats_provider=providers.stats.clone()
                log_provider=providers.log.clone()
                settings_provider=providers.settings.clone()
                upload_settings_provider=providers.upload_settings.clone()
                tweet_provider=providers.tweet.clone()
            />
        }
    });
}

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "ui";
