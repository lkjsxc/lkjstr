#![doc = "Pure workspace layout and tab model."]

mod bootstrap;
mod commands;
mod group;
mod layout;
mod model;
mod recovery;
mod tab;

pub use bootstrap::{BootstrapIds, bootstrap_workspace};
pub use commands::{NewTabIds, close_workspace_tab, focus_tab, open_tab, split_focused_pane};
pub use group::TabGroup;
pub use layout::{LayoutNode, NewPaneIds, PaneNode, SplitDirection, SplitNode};
pub use model::{Workspace, WorkspaceIds, create_workspace};
pub use recovery::ensure_usable_workspace;
pub use tab::{TabKind, WorkspaceTab, title_for};
