#![doc = "Workspace shell components."]

mod menu;
mod pane;
mod persistence;
mod settings;
mod settings_provider;
mod settings_row;
mod shell;
mod state;
mod stats;
mod stats_provider;
mod tab_body;
mod welcome;

pub use persistence::WorkspacePersistence;
pub use settings_provider::{SettingsCommand, SettingsComplete, SettingsProvider, SettingsResult};
pub use settings_provider::{SettingsImportCommand, SettingsKeyCommand, SettingsValueCommand};
pub use shell::WorkspaceShell;
pub use stats_provider::{StatsComplete, StatsProvider};
