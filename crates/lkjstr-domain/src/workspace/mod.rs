#![doc = "Pure workspace layout and tab model."]

mod bootstrap;
mod commands;
mod group;
mod layout;
mod model;
mod recovery;
mod snapshot;
mod snapshot_ops;
mod tab;

pub use bootstrap::{BootstrapIds, bootstrap_workspace};
pub use commands::{NewTabIds, close_workspace_tab, focus_tab, open_tab, split_focused_pane};
pub use group::TabGroup;
pub use layout::{LayoutNode, NewPaneIds, PaneNode, SplitDirection, SplitNode};
pub use model::{Workspace, WorkspaceIds, create_workspace};
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
pub use tab::{TabKind, WorkspaceTab, title_for};
