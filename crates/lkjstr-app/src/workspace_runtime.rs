#![doc = "Workspace startup and tab snapshot runtime reducers."]

use std::collections::BTreeMap;

use lkjstr_domain::{
    NewTabIds, TabKind, TabSnapshotPayload, Workspace, WorkspaceIds, bootstrap_workspace,
    close_workspace_tab, ensure_usable_workspace, focus_tab, open_tab,
};
use lkjstr_storage::{TabStateRecord, tab_state_id};

pub const DEFAULT_WARM_SNAPSHOT_CAP: usize = 32;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StartupSource {
    Stored,
    Bootstrap,
    StorageUnavailable,
    Recovered,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StartupInput {
    pub stored_workspace: Option<Workspace>,
    pub storage_available: bool,
    pub recovery_ids: WorkspaceIds,
    pub now: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StartupResult {
    pub state: WorkspaceRuntimeState,
    pub source: StartupSource,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceRuntimeState {
    pub workspace: Workspace,
    pub tab_snapshots: BTreeMap<String, TabStateRecord>,
    pub warm_tab_order: Vec<String>,
    pub warm_snapshot_cap: usize,
}

#[must_use]
pub fn start_workspace(input: StartupInput) -> StartupResult {
    if !input.storage_available {
        return startup_result(
            ensure_usable_workspace(empty_workspace(), input.recovery_ids, input.now),
            StartupSource::StorageUnavailable,
        );
    }
    let Some(stored) = input.stored_workspace else {
        return startup_result(bootstrap_workspace(), StartupSource::Bootstrap);
    };
    let recovered = ensure_usable_workspace(stored.clone(), input.recovery_ids, input.now);
    let source = if recovered == stored {
        StartupSource::Stored
    } else {
        StartupSource::Recovered
    };
    startup_result(recovered, source)
}

#[must_use]
pub fn open_runtime_tab(
    mut state: WorkspaceRuntimeState,
    pane_id: Option<&str>,
    kind: TabKind,
    ids: NewTabIds,
    now: u64,
) -> WorkspaceRuntimeState {
    state.workspace = open_tab(state.workspace, pane_id, kind, ids, now);
    state
}

#[must_use]
pub fn focus_runtime_tab(
    mut state: WorkspaceRuntimeState,
    pane_id: &str,
    tab_id: &str,
    now: u64,
) -> WorkspaceRuntimeState {
    state.workspace = focus_tab(state.workspace, pane_id, tab_id, now);
    state
}

#[must_use]
pub fn close_runtime_tab(
    mut state: WorkspaceRuntimeState,
    pane_id: &str,
    tab_id: &str,
    recovery_ids: WorkspaceIds,
    now: u64,
) -> WorkspaceRuntimeState {
    let snapshot_id = tab_state_id(&state.workspace.id, tab_id);
    state.workspace = close_workspace_tab(state.workspace, pane_id, tab_id, recovery_ids, now);
    state.tab_snapshots.remove(&snapshot_id);
    state.warm_tab_order.retain(|id| id != tab_id);
    state
}

#[must_use]
pub fn record_tab_snapshot(
    mut state: WorkspaceRuntimeState,
    pane_id: Option<&str>,
    tab_id: &str,
    payload: TabSnapshotPayload,
    now: u64,
) -> WorkspaceRuntimeState {
    if !state.workspace.tabs.contains_key(tab_id) {
        return state;
    }
    let id = tab_state_id(&state.workspace.id, tab_id);
    let row = TabStateRecord {
        id: id.clone(),
        workspace_id: state.workspace.id.clone(),
        tab_id: tab_id.to_owned(),
        last_pane_id: pane_id.map(str::to_owned),
        state: payload,
        updated_at: now,
    };
    state.tab_snapshots.insert(id, row);
    mark_warm_tab(state, tab_id)
}

#[must_use]
pub fn default_recovery_ids(workspace_id: &str) -> WorkspaceIds {
    WorkspaceIds {
        workspace_id: workspace_id.to_owned(),
        pane_id: "recovered-pane".to_owned(),
        group_id: "recovered-group".to_owned(),
        tab_id: "recovered-welcome-tab".to_owned(),
    }
}

fn startup_result(workspace: Workspace, source: StartupSource) -> StartupResult {
    StartupResult {
        state: WorkspaceRuntimeState {
            workspace,
            tab_snapshots: BTreeMap::new(),
            warm_tab_order: Vec::new(),
            warm_snapshot_cap: DEFAULT_WARM_SNAPSHOT_CAP,
        },
        source,
    }
}

fn empty_workspace() -> Workspace {
    Workspace {
        id: "main".to_owned(),
        name: "Main workspace".to_owned(),
        layout: None,
        tab_groups: BTreeMap::new(),
        tabs: BTreeMap::new(),
        focused_pane_id: None,
        focused_tab_id: None,
        active_account_id: None,
        sidebar_visible: false,
        activity_bar_visible: false,
        updated_at: 0,
    }
}

fn mark_warm_tab(mut state: WorkspaceRuntimeState, tab_id: &str) -> WorkspaceRuntimeState {
    state.warm_tab_order.retain(|id| id != tab_id);
    state.warm_tab_order.push(tab_id.to_owned());
    while state.warm_tab_order.len() > state.warm_snapshot_cap {
        let Some(oldest_tab_id) = state.warm_tab_order.first().cloned() else {
            break;
        };
        state.warm_tab_order.remove(0);
        state
            .tab_snapshots
            .remove(&tab_state_id(&state.workspace.id, &oldest_tab_id));
    }
    state
}
