#![doc = "Workspace shell components."]

mod menu;
mod pane;
mod persistence;
mod shell;
mod state;
mod stats;
mod stats_provider;
mod tab_body;
mod welcome;

pub use persistence::WorkspacePersistence;
pub use shell::WorkspaceShell;
pub use stats_provider::{StatsComplete, StatsProvider};
