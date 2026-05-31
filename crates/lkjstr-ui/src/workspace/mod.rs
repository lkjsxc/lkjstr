#![doc = "Workspace shell components."]

mod menu;
mod pane;
mod persistence;
mod shell;
mod state;
mod tab_body;
mod welcome;

pub use persistence::WorkspacePersistence;
pub use shell::WorkspaceShell;
