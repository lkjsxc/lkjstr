#![doc = "Leptos UI components for lkjstr."]

mod app;
mod workspace;

pub use app::{App, AppWithStartup, default_startup_input};
pub use workspace::{
    AccountsCommand, AccountsComplete, AccountsProvider, AccountsResult, RelaySettingsCommand,
    RelaySettingsComplete, RelaySettingsProvider, RelaySettingsResult, SettingsCommand,
    SettingsComplete, SettingsProvider, SettingsResult, StatsComplete, StatsProvider,
    WorkspacePersistence,
};
pub use workspace::{AccountsIdCommand, AccountsInputCommand};
pub use workspace::{
    RelayIdCommand, RelayInputCommand, RelayPatchCommand, RelayPurposeCommand, RelaySetIdCommand,
};
pub use workspace::{SettingsImportCommand, SettingsKeyCommand, SettingsValueCommand};

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
pub fn mount_app_with_host(
    startup: lkjstr_app::StartupInput,
    persistence: WorkspacePersistence,
    accounts_provider: AccountsProvider,
    relay_settings_provider: RelaySettingsProvider,
    stats_provider: StatsProvider,
    settings_provider: SettingsProvider,
) {
    leptos::mount::mount_to_body(move || {
        leptos::view! {
            <AppWithStartup
                startup=startup.clone()
                persistence=persistence.clone()
                accounts_provider=accounts_provider.clone()
                relay_settings_provider=relay_settings_provider.clone()
                stats_provider=stats_provider.clone()
                settings_provider=settings_provider.clone()
            />
        }
    });
}

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "ui";
