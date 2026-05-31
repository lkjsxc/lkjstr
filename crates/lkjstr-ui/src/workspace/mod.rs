#![doc = "Workspace shell components."]

mod accounts;
mod accounts_provider;
mod accounts_row;
mod menu;
mod pane;
mod persistence;
mod relay_row;
mod relay_settings;
mod relay_settings_provider;
mod relay_settings_section;
mod settings;
mod settings_provider;
mod settings_row;
mod shell;
mod state;
mod stats;
mod stats_provider;
mod tab_body;
mod welcome;

pub use accounts_provider::{AccountsCommand, AccountsComplete, AccountsProvider, AccountsResult};
pub use accounts_provider::{AccountsIdCommand, AccountsInputCommand};
pub use persistence::WorkspacePersistence;
pub use relay_settings_provider::{
    RelayIdCommand, RelayInputCommand, RelayPatchCommand, RelayPurposeCommand, RelaySetIdCommand,
    RelaySettingsCommand, RelaySettingsComplete, RelaySettingsProvider, RelaySettingsResult,
};
pub use settings_provider::{SettingsCommand, SettingsComplete, SettingsProvider, SettingsResult};
pub use settings_provider::{SettingsImportCommand, SettingsKeyCommand, SettingsValueCommand};
pub use shell::WorkspaceShell;
pub use stats_provider::{StatsComplete, StatsProvider};
