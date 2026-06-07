#![doc = "Pure workspace layout and tab model."]

mod bootstrap;
mod commands;
mod group;
mod layout;
mod layout_insert;
mod model;
mod move_tab;
mod recovery;
mod snapshot;
mod snapshot_ops;
mod tab;
mod tab_catalog;

pub use bootstrap::{BootstrapIds, bootstrap_workspace};
pub use commands::{
    NewTabIds, close_workspace_tab, convert_tab, focus_tab, open_configured_tab, open_tab,
    split_focused_pane,
};
pub use group::TabGroup;
pub use layout::{LayoutNode, NewPaneIds, PaneNode, SplitDirection, SplitNode};
pub use model::{Workspace, WorkspaceIds, create_workspace};
pub use move_tab::{
    EdgePaneIds, MoveTabInput, TabDropEdge, move_workspace_tab, move_workspace_tab_to_edge,
};
pub use recovery::ensure_usable_workspace;
pub use snapshot::{
    FeedCursorPoint, FeedRuntimeSnapshotSource, FeedSnapshotSeed, FeedTabSnapshot,
    FeedTabSnapshotPatch, HistoryExhaustion, TabAnchor, TabSnapshotPatch, TabSnapshotPayload,
    TabSnapshotRestore, ToolTabSnapshot, ToolTabSnapshotPatch,
};
pub use snapshot_ops::{
    capture_tab_snapshot, feed_anchor_from_payload, feed_runtime_snapshot,
    feed_snapshot_seed_from_payload, merge_tab_snapshot, merge_tab_snapshot_payload,
};
pub use tab::{TabKind, WorkspaceTab, tab_kind_key, title_for};
pub use tab_catalog::{LKJSXC_TIMELINE_PUBKEY, NewTabOption, new_tab_options_for_account};
