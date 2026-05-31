#![doc = "Workspace root model."]

use std::collections::BTreeMap;

use crate::workspace::group::TabGroup;
use crate::workspace::layout::{LayoutNode, PaneNode};
use crate::workspace::tab::{TabKind, WorkspaceTab};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub layout: Option<LayoutNode>,
    pub tab_groups: BTreeMap<String, TabGroup>,
    pub tabs: BTreeMap<String, WorkspaceTab>,
    pub focused_pane_id: Option<String>,
    pub focused_tab_id: Option<String>,
    pub active_account_id: Option<String>,
    pub sidebar_visible: bool,
    pub activity_bar_visible: bool,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceIds {
    pub workspace_id: String,
    pub pane_id: String,
    pub group_id: String,
    pub tab_id: String,
}

#[must_use]
pub fn create_workspace(ids: WorkspaceIds, now: u64) -> Workspace {
    let tab = WorkspaceTab::new(ids.tab_id, TabKind::Welcome, now);
    let group = TabGroup::new(ids.group_id, &tab);
    let pane = PaneNode::new(ids.pane_id, group.id.clone());
    Workspace {
        id: ids.workspace_id,
        name: "Main workspace".to_owned(),
        layout: Some(LayoutNode::Pane(pane.clone())),
        tab_groups: BTreeMap::from([(group.id.clone(), group)]),
        tabs: BTreeMap::from([(tab.id.clone(), tab.clone())]),
        focused_pane_id: Some(pane.id),
        focused_tab_id: Some(tab.id),
        active_account_id: None,
        sidebar_visible: false,
        activity_bar_visible: false,
        updated_at: now,
    }
}

#[must_use]
pub fn touch(mut workspace: Workspace, now: u64) -> Workspace {
    workspace.updated_at = now;
    workspace
}
