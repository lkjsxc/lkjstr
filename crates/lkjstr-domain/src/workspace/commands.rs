#![doc = "Workspace commands."]

use std::collections::BTreeMap;

use crate::workspace::group::TabGroup;
use crate::workspace::layout::{NewPaneIds, PaneNode, SplitDirection};
use crate::workspace::model::{Workspace, WorkspaceIds, touch};
use crate::workspace::recovery::ensure_usable_workspace;
use crate::workspace::tab::{TabKind, WorkspaceTab};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewTabIds {
    pub tab_id: String,
}

#[must_use]
pub fn open_tab(
    workspace: Workspace,
    pane_id: Option<&str>,
    kind: TabKind,
    ids: NewTabIds,
    now: u64,
) -> Workspace {
    open_configured_tab(workspace, pane_id, kind, ids, BTreeMap::new(), now)
}

#[must_use]
pub fn open_configured_tab(
    mut workspace: Workspace,
    pane_id: Option<&str>,
    kind: TabKind,
    ids: NewTabIds,
    config: BTreeMap<String, String>,
    now: u64,
) -> Workspace {
    let Some(layout) = &workspace.layout else {
        return workspace;
    };
    let target_pane_id = pane_id
        .map(str::to_owned)
        .or_else(|| workspace.focused_pane_id.clone())
        .or_else(|| layout.pane_ids().first().cloned());
    let Some(target_pane_id) = target_pane_id else {
        return workspace;
    };
    let Some(pane) = layout.find_pane(&target_pane_id) else {
        return workspace;
    };
    let tab = WorkspaceTab::new(ids.tab_id, kind, now).with_config(config, now);
    let mut group = workspace
        .tab_groups
        .get(&pane.tab_group_id)
        .cloned()
        .unwrap_or_else(|| TabGroup {
            id: pane.tab_group_id.clone(),
            tab_ids: Vec::new(),
            active_tab_id: None,
            pinned_tab_ids: Vec::new(),
            closed_tabs: Vec::new(),
        });
    group = group.add_tab(&tab.id);
    workspace.tabs.insert(tab.id.clone(), tab.clone());
    workspace.tab_groups.insert(group.id.clone(), group);
    workspace.focused_pane_id = Some(pane.id.clone());
    workspace.focused_tab_id = Some(tab.id);
    touch(workspace, now)
}

#[must_use]
pub fn convert_tab(
    mut workspace: Workspace,
    pane_id: &str,
    tab_id: &str,
    kind: TabKind,
    config: BTreeMap<String, String>,
    now: u64,
) -> Workspace {
    let Some(layout) = &workspace.layout else {
        return workspace;
    };
    let Some(pane) = layout.find_pane(pane_id) else {
        return workspace;
    };
    let Some(group) = workspace.tab_groups.get(&pane.tab_group_id) else {
        return workspace;
    };
    if !group.tab_ids.iter().any(|id| id == tab_id) {
        return workspace;
    }
    let Some(existing) = workspace.tabs.get(tab_id) else {
        return workspace;
    };
    let mut next_tab = WorkspaceTab::new(existing.id.clone(), kind, now).with_config(config, now);
    next_tab.created_at = existing.created_at;
    workspace.tabs.insert(tab_id.to_owned(), next_tab);
    workspace
        .tab_groups
        .insert(group.id.clone(), group.activate(tab_id));
    workspace.focused_pane_id = Some(pane_id.to_owned());
    workspace.focused_tab_id = Some(tab_id.to_owned());
    touch(workspace, now)
}

#[must_use]
pub fn focus_tab(mut workspace: Workspace, pane_id: &str, tab_id: &str, now: u64) -> Workspace {
    let Some(layout) = &workspace.layout else {
        return workspace;
    };
    let Some(pane) = layout.find_pane(pane_id) else {
        return workspace;
    };
    let Some(group) = workspace.tab_groups.get(&pane.tab_group_id) else {
        return workspace;
    };
    if !group.tab_ids.iter().any(|id| id == tab_id) {
        return workspace;
    }
    workspace
        .tab_groups
        .insert(group.id.clone(), group.activate(tab_id));
    workspace.focused_pane_id = Some(pane_id.to_owned());
    workspace.focused_tab_id = Some(tab_id.to_owned());
    touch(workspace, now)
}

#[must_use]
pub fn split_focused_pane(
    mut workspace: Workspace,
    direction: SplitDirection,
    ids: NewPaneIds,
    now: u64,
) -> Workspace {
    let Some(layout) = &workspace.layout else {
        return workspace;
    };
    let Some(focused_pane_id) = &workspace.focused_pane_id else {
        return workspace;
    };
    let tab = WorkspaceTab::new(ids.tab_id, TabKind::NewTab, now);
    let group = TabGroup::new(ids.group_id, &tab);
    let pane = PaneNode::new(ids.pane_id, group.id.clone());
    workspace.layout =
        Some(layout.split_pane(focused_pane_id, &ids.split_id, direction, pane.clone()));
    workspace.tab_groups.insert(group.id.clone(), group);
    workspace.tabs.insert(tab.id.clone(), tab.clone());
    workspace.focused_pane_id = Some(pane.id);
    workspace.focused_tab_id = Some(tab.id);
    touch(workspace, now)
}

#[must_use]
pub fn close_workspace_tab(
    mut workspace: Workspace,
    pane_id: &str,
    tab_id: &str,
    recovery_ids: WorkspaceIds,
    now: u64,
) -> Workspace {
    let Some(layout) = &workspace.layout else {
        return ensure_usable_workspace(workspace, recovery_ids, now);
    };
    let Some(pane) = layout.find_pane(pane_id) else {
        return ensure_usable_workspace(workspace, recovery_ids, now);
    };
    let Some(group) = workspace.tab_groups.get(&pane.tab_group_id) else {
        return ensure_usable_workspace(workspace, recovery_ids, now);
    };
    let Some(tab) = workspace.tabs.get(tab_id) else {
        return ensure_usable_workspace(workspace, recovery_ids, now);
    };
    let next_group = group.close_tab(tab);
    workspace.tabs.remove(tab_id);
    if !next_group.tab_ids.is_empty() {
        workspace.focused_pane_id = Some(pane.id.clone());
        workspace.focused_tab_id = next_group.active_tab_id.clone();
        workspace.tab_groups.insert(group.id.clone(), next_group);
        return ensure_usable_workspace(touch(workspace, now), recovery_ids, now);
    }
    let group_id = group.id.clone();
    workspace.tab_groups.remove(&group_id);
    workspace.layout = layout.remove_pane(pane_id);
    workspace.focused_pane_id = None;
    workspace.focused_tab_id = None;
    ensure_usable_workspace(touch(workspace, now), recovery_ids, now)
}
