#![doc = "Workspace recovery helpers."]

use std::collections::BTreeMap;

use crate::workspace::group::TabGroup;
use crate::workspace::model::{Workspace, WorkspaceIds, create_workspace, touch};
use crate::workspace::tab::WorkspaceTab;

#[must_use]
pub fn ensure_usable_workspace(workspace: Workspace, ids: WorkspaceIds, now: u64) -> Workspace {
    let Some(layout) = &workspace.layout else {
        return recovery(workspace, ids, now);
    };
    let pane_ids = layout.pane_ids();
    if pane_ids.is_empty() {
        return recovery(workspace, ids, now);
    }
    let Some((tabs, tab_groups)) = normalize_records(&workspace, &pane_ids) else {
        return recovery(workspace, ids, now);
    };
    let focused_pane_id = focused_pane(&workspace, &pane_ids);
    let focused_tab_id = focused_tab(&workspace, &tab_groups, &focused_pane_id);
    Workspace {
        tabs,
        tab_groups,
        focused_pane_id: Some(focused_pane_id),
        focused_tab_id,
        ..workspace
    }
}

fn recovery(source: Workspace, ids: WorkspaceIds, now: u64) -> Workspace {
    let mut recovered = create_workspace(ids, now);
    recovered.id = source.id;
    recovered.name = source.name;
    recovered.active_account_id = source.active_account_id;
    touch(recovered, now)
}

fn normalize_records(
    workspace: &Workspace,
    pane_ids: &[String],
) -> Option<(BTreeMap<String, WorkspaceTab>, BTreeMap<String, TabGroup>)> {
    let mut tabs = BTreeMap::new();
    let mut tab_groups = BTreeMap::new();
    let layout = workspace.layout.as_ref()?;
    for pane_id in pane_ids {
        let pane = layout.find_pane(pane_id)?;
        let group = workspace.tab_groups.get(&pane.tab_group_id)?;
        let tab_ids: Vec<String> = group
            .tab_ids
            .iter()
            .filter(|id| workspace.tabs.contains_key(*id))
            .cloned()
            .collect();
        if tab_ids.is_empty() {
            return None;
        }
        for id in &tab_ids {
            let tab = workspace.tabs.get(id)?;
            tabs.insert(id.clone(), tab.clone());
        }
        let active = group
            .active_tab_id
            .clone()
            .filter(|id| tab_ids.contains(id))
            .or_else(|| tab_ids.first().cloned());
        tab_groups.insert(
            group.id.clone(),
            TabGroup {
                tab_ids,
                active_tab_id: active,
                ..group.clone()
            },
        );
    }
    Some((tabs, tab_groups))
}

fn focused_pane(workspace: &Workspace, pane_ids: &[String]) -> String {
    match (&workspace.focused_pane_id, &workspace.layout) {
        (Some(id), Some(layout)) if layout.find_pane(id).is_some() => id.clone(),
        _ => pane_ids.first().cloned().unwrap_or_default(),
    }
}

fn focused_tab(
    workspace: &Workspace,
    tab_groups: &BTreeMap<String, TabGroup>,
    focused_pane_id: &str,
) -> Option<String> {
    if let Some(id) = &workspace.focused_tab_id
        && workspace.tabs.contains_key(id)
    {
        return Some(id.clone());
    }
    let layout = workspace.layout.as_ref()?;
    let pane = layout.find_pane(focused_pane_id)?;
    tab_groups.get(&pane.tab_group_id)?.active_tab_id.clone()
}
