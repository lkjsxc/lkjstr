use lkjstr_domain::{
    EdgePaneIds, LayoutNode, MoveTabInput, NewPaneIds, NewTabIds, SplitDirection, TabDropEdge,
    TabGroup, TabKind, Workspace, WorkspaceIds, create_workspace, move_workspace_tab,
    move_workspace_tab_to_edge, open_tab, split_focused_pane,
};

#[test]
fn reorders_tabs_in_same_pane() -> Result<(), String> {
    let workspace = create_seed_workspace();
    let pane_id = focused_pane_id(&workspace)?;
    let workspace = open_tab(
        workspace,
        Some(&pane_id),
        TabKind::Settings,
        NewTabIds {
            tab_id: "settings-tab".to_owned(),
        },
        1,
    );
    let workspace = open_tab(
        workspace,
        Some(&pane_id),
        TabKind::Notifications,
        NewTabIds {
            tab_id: "notifications-tab".to_owned(),
        },
        2,
    );
    let moved_tab_id = group_for_pane(&workspace, &pane_id)?
        .tab_ids
        .first()
        .cloned()
        .ok_or_else(|| "missing first tab".to_owned())?;

    let moved = move_workspace_tab(
        workspace,
        MoveTabInput {
            source_pane_id: pane_id.clone(),
            target_pane_id: pane_id.clone(),
            tab_id: moved_tab_id.clone(),
            target_index: 99,
        },
        3,
    );

    assert_eq!(
        group_for_pane(&moved, &pane_id)?
            .tab_ids
            .last()
            .map(String::as_str),
        Some(moved_tab_id.as_str())
    );
    assert_eq!(moved.focused_tab_id.as_deref(), Some(moved_tab_id.as_str()));
    Ok(())
}

#[test]
fn moves_last_tab_across_panes_and_removes_source() -> Result<(), String> {
    let workspace = split_focused_pane(
        create_seed_workspace(),
        SplitDirection::Horizontal,
        NewPaneIds {
            pane_id: "new-pane".to_owned(),
            group_id: "new-group".to_owned(),
            tab_id: "new-tab".to_owned(),
            split_id: "root-split".to_owned(),
        },
        1,
    );
    let source_pane_id = focused_pane_id(&workspace)?;
    let target_pane_id = other_pane_id(&workspace, &source_pane_id)?;

    let moved = move_workspace_tab(
        workspace,
        MoveTabInput {
            source_pane_id: source_pane_id.clone(),
            target_pane_id: target_pane_id.clone(),
            tab_id: "new-tab".to_owned(),
            target_index: 1,
        },
        2,
    );

    assert_eq!(pane_ids(&moved)?, vec![target_pane_id.clone()]);
    assert!(
        group_for_pane(&moved, &target_pane_id)?
            .tab_ids
            .iter()
            .any(|id| id == "new-tab")
    );
    assert_eq!(
        moved.focused_pane_id.as_deref(),
        Some(target_pane_id.as_str())
    );
    Ok(())
}

#[test]
fn edge_drop_splits_target_and_focuses_moved_tab() -> Result<(), String> {
    let split = split_focused_pane(
        create_seed_workspace(),
        SplitDirection::Horizontal,
        NewPaneIds {
            pane_id: "source-pane".to_owned(),
            group_id: "source-group".to_owned(),
            tab_id: "source-new-tab".to_owned(),
            split_id: "root-split".to_owned(),
        },
        1,
    );
    let source_pane_id = focused_pane_id(&split)?;
    let opened = open_tab(
        split,
        Some(&source_pane_id),
        TabKind::Settings,
        NewTabIds {
            tab_id: "settings-tab".to_owned(),
        },
        2,
    );
    let target_pane_id = other_pane_id(&opened, &source_pane_id)?;

    let moved = move_workspace_tab_to_edge(
        opened,
        MoveTabInput {
            source_pane_id,
            target_pane_id,
            tab_id: "settings-tab".to_owned(),
            target_index: 0,
        },
        TabDropEdge::Left,
        EdgePaneIds {
            pane_id: "edge-pane".to_owned(),
            group_id: "edge-group".to_owned(),
            split_id: "edge-split".to_owned(),
        },
        3,
    );

    assert_eq!(pane_ids(&moved)?.len(), 3);
    assert_eq!(moved.focused_pane_id.as_deref(), Some("edge-pane"));
    assert_eq!(
        group_for_pane(&moved, "edge-pane")?.tab_ids,
        vec!["settings-tab".to_owned()]
    );
    Ok(())
}

fn create_seed_workspace() -> Workspace {
    create_workspace(
        WorkspaceIds {
            workspace_id: "workspace".to_owned(),
            pane_id: "seed-pane".to_owned(),
            group_id: "seed-group".to_owned(),
            tab_id: "seed-tab".to_owned(),
        },
        0,
    )
}

fn focused_pane_id(workspace: &Workspace) -> Result<String, String> {
    workspace
        .focused_pane_id
        .clone()
        .ok_or_else(|| "missing focused pane".to_owned())
}

fn other_pane_id(workspace: &Workspace, source: &str) -> Result<String, String> {
    pane_ids(workspace)?
        .into_iter()
        .find(|id| id != source)
        .ok_or_else(|| "missing other pane".to_owned())
}

fn pane_ids(workspace: &Workspace) -> Result<Vec<String>, String> {
    layout(workspace).map(LayoutNode::pane_ids)
}

fn group_for_pane<'a>(workspace: &'a Workspace, pane_id: &str) -> Result<&'a TabGroup, String> {
    let pane = layout(workspace)?
        .find_pane(pane_id)
        .ok_or_else(|| format!("missing pane {pane_id}"))?;
    workspace
        .tab_groups
        .get(&pane.tab_group_id)
        .ok_or_else(|| format!("missing group {}", pane.tab_group_id))
}

fn layout(workspace: &Workspace) -> Result<&LayoutNode, String> {
    workspace
        .layout
        .as_ref()
        .ok_or_else(|| "missing layout".to_owned())
}
