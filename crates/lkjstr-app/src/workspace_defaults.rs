#![doc = "Workspace runtime defaults."]

use std::collections::BTreeMap;

use lkjstr_domain::{Workspace, WorkspaceIds};

pub const DEFAULT_WARM_SNAPSHOT_CAP: usize = 32;

#[must_use]
pub fn default_recovery_ids(workspace_id: &str) -> WorkspaceIds {
    WorkspaceIds {
        workspace_id: workspace_id.to_owned(),
        pane_id: "recovered-pane".to_owned(),
        group_id: "recovered-group".to_owned(),
        tab_id: "recovered-welcome-tab".to_owned(),
    }
}

#[must_use]
pub fn empty_workspace() -> Workspace {
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
