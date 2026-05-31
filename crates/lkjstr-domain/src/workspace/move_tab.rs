#![doc = "Workspace tab movement reducers."]

use crate::workspace::group::TabGroup;
use crate::workspace::layout::{LayoutNode, PaneNode};
use crate::workspace::layout_insert::insert_pane_by_edge;
use crate::workspace::model::Workspace;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TabDropEdge {
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MoveTabInput {
    pub source_pane_id: String,
    pub target_pane_id: String,
    pub tab_id: String,
    pub target_index: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EdgePaneIds {
    pub pane_id: String,
    pub group_id: String,
    pub split_id: String,
}

#[must_use]
pub fn move_workspace_tab(mut workspace: Workspace, input: MoveTabInput, now: u64) -> Workspace {
    let Some(layout) = workspace.layout.clone() else {
        return workspace;
    };
    let Some(parts) = move_parts(&workspace, &layout, &input) else {
        return workspace;
    };
    if parts.source_pane.id == parts.target_pane.id {
        let moved = parts
            .source_group
            .insert_moved(&input.tab_id, input.target_index);
        workspace.tab_groups.insert(parts.source_group.id, moved);
        workspace.focused_pane_id = Some(parts.target_pane.id);
        workspace.focused_tab_id = Some(input.tab_id);
        workspace.updated_at = now;
        return workspace;
    }
    workspace = move_between_groups(workspace, layout, input, parts);
    workspace.updated_at = now;
    workspace
}

#[must_use]
pub fn move_workspace_tab_to_edge(
    mut workspace: Workspace,
    input: MoveTabInput,
    edge: TabDropEdge,
    ids: EdgePaneIds,
    now: u64,
) -> Workspace {
    let Some(layout) = workspace.layout.clone() else {
        return workspace;
    };
    let Some(parts) = move_parts(&workspace, &layout, &input) else {
        return workspace;
    };
    if parts.source_pane.id == parts.target_pane.id && parts.source_group.tab_ids.len() <= 1 {
        return workspace;
    }
    let mut tab_groups = workspace.tab_groups.clone();
    let next_source = parts.source_group.remove_for_move(&input.tab_id);
    let mut layout = layout;
    if next_source.tab_ids.is_empty() {
        tab_groups.remove(&parts.source_group.id);
        if let Some(next_layout) = layout.remove_pane(&parts.source_pane.id) {
            layout = next_layout;
        }
    } else {
        tab_groups.insert(parts.source_group.id, next_source);
    }
    let new_group = TabGroup {
        id: ids.group_id.clone(),
        tab_ids: vec![input.tab_id.clone()],
        active_tab_id: Some(input.tab_id.clone()),
        pinned_tab_ids: Vec::new(),
        closed_tabs: Vec::new(),
    };
    let new_pane = PaneNode::new(ids.pane_id.clone(), ids.group_id);
    tab_groups.insert(new_group.id.clone(), new_group);
    workspace.layout = Some(insert_pane_by_edge(
        &layout,
        &input.target_pane_id,
        edge,
        new_pane,
        &ids.split_id,
    ));
    workspace.tab_groups = tab_groups;
    workspace.focused_pane_id = Some(ids.pane_id);
    workspace.focused_tab_id = Some(input.tab_id);
    workspace.updated_at = now;
    workspace
}

struct MoveParts {
    source_pane: PaneNode,
    target_pane: PaneNode,
    source_group: TabGroup,
    target_group: TabGroup,
}

fn move_parts(
    workspace: &Workspace,
    layout: &LayoutNode,
    input: &MoveTabInput,
) -> Option<MoveParts> {
    let source_pane = layout.find_pane(&input.source_pane_id)?.clone();
    let target_pane = layout.find_pane(&input.target_pane_id)?.clone();
    let source_group = workspace.tab_groups.get(&source_pane.tab_group_id)?.clone();
    let target_group = workspace.tab_groups.get(&target_pane.tab_group_id)?.clone();
    let has_tab = workspace.tabs.contains_key(&input.tab_id)
        && source_group.tab_ids.iter().any(|id| id == &input.tab_id);
    (has_tab && (source_group.id != target_group.id || source_pane.id == target_pane.id)).then_some(
        MoveParts {
            source_pane,
            target_pane,
            source_group,
            target_group,
        },
    )
}

fn move_between_groups(
    mut workspace: Workspace,
    layout: LayoutNode,
    input: MoveTabInput,
    parts: MoveParts,
) -> Workspace {
    let next_source = parts.source_group.remove_for_move(&input.tab_id);
    let next_target = parts
        .target_group
        .insert_moved(&input.tab_id, input.target_index);
    workspace
        .tab_groups
        .insert(parts.target_group.id, next_target);
    if next_source.tab_ids.is_empty() {
        workspace.tab_groups.remove(&parts.source_group.id);
        workspace.layout = layout.remove_pane(&parts.source_pane.id).or(Some(layout));
    } else {
        workspace
            .tab_groups
            .insert(parts.source_group.id, next_source);
        workspace.layout = Some(layout);
    }
    workspace.focused_pane_id = Some(parts.target_pane.id);
    workspace.focused_tab_id = Some(input.tab_id);
    workspace
}
