#![doc = "Pure domain reducers and models for lkjstr."]

pub mod accounts;
pub mod local_account;
pub mod npub_miner;
pub mod relay_sets;
pub mod workspace;

pub use accounts::{
    Account, AccountCapabilities, SignerType, capabilities_for, create_account,
    create_labeled_account, normalize_account, parse_pubkey, parse_readonly_account, short_key,
    signer_type_key,
};
pub use local_account::{
    LocalAccountError, LocalAccountSecret, create_local_account_record, generate_nsec, parse_nsec,
    sign_local_event,
};
pub use npub_miner::{
    NpubPrefix, NpubPrefixError, estimated_attempts, npub_matches_prefix, parse_npub_prefix,
};
pub use relay_sets::{
    RelayConnectionState, RelayHealth, RelayPatch, RelayPurpose, RelayRecord, RelaySet,
    RelaySetError, add_relay, default_discovery_relay_set, default_user_relay_set, ensure_user_set,
    patch_relay, remove_relay, reset_relay_live_state, restore_default_relay_set, seed_relay_sets,
    sorted_relay_sets,
};
pub use workspace::{
    BootstrapIds, EdgePaneIds, FeedCursorPoint, FeedRuntimeSnapshotSource, FeedSnapshotSeed,
    FeedTabSnapshot, FeedTabSnapshotPatch, HistoryExhaustion, LayoutNode, MoveTabInput, NewPaneIds,
    NewTabIds, NewTabOption, NewTabOptionGroup, PaneNode, SplitDirection, TabAnchor, TabDropEdge,
    TabGroup, TabKind, TabSnapshotPatch, TabSnapshotPayload, TabSnapshotRestore, ToolTabSnapshot,
    ToolTabSnapshotPatch, Workspace, WorkspaceIds, WorkspaceTab, bootstrap_workspace,
    capture_tab_snapshot, close_workspace_tab, convert_tab, create_workspace,
    ensure_usable_workspace, feed_anchor_from_payload, feed_runtime_snapshot,
    feed_snapshot_seed_from_payload, focus_tab, merge_tab_snapshot, merge_tab_snapshot_payload,
    move_workspace_tab, move_workspace_tab_to_edge, new_tab_options_for_account,
    open_configured_tab, open_tab, split_focused_pane, title_for,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "domain";
