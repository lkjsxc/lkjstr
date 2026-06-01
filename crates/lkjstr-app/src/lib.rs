#![doc = "Pure application composition reducers for lkjstr."]

mod startup_snapshots;
mod workspace_defaults;
pub mod workspace_runtime;

pub use workspace_runtime::{
    DEFAULT_WARM_SNAPSHOT_CAP, StartupInput, StartupResult, StartupSource, WorkspaceRuntimeState,
    close_runtime_tab, convert_runtime_tab, default_recovery_ids, focus_runtime_tab,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "app";
