use std::collections::BTreeMap;

use lkjstr_domain::{
    LayoutNode, NewPaneIds, NewTabIds, SplitDirection, TabKind, WorkspaceIds, bootstrap_workspace,
    close_workspace_tab, convert_tab, create_workspace, ensure_usable_workspace, focus_tab,
    open_tab, split_focused_pane,
};

#[test]
fn boots_into_welcome_plus_main_startup_tabs() -> Result<(), &'static str> {
    let workspace = bootstrap_workspace();
    let Some(LayoutNode::Split(split)) = workspace.layout else {
        return Err("expected split");
    };
    assert_eq!(split.direction, SplitDirection::Vertical);
    assert_eq!(split.sizes, vec![4000, 6000]);
    let LayoutNode::Pane(right) = &split.children[1] else {
        return Err("expected pane");
    };
    let group = workspace.tab_groups.get(&right.tab_group_id);
    let titles = group.map(|item| {
        item.tab_ids
            .iter()
            .filter_map(|id| workspace.tabs.get(id))
            .map(|tab| tab.title.as_str())
            .collect::<Vec<_>>()
    });
    assert_eq!(
        titles,
        Some(vec![
            "Accounts",
            "Relay Settings",
            "Home",
            "Notifications",
            "Tweet"
        ])
    );
    assert_eq!(
        workspace.focused_tab_id.as_deref(),
        Some("bootstrap-welcome-tab")
    );
    Ok(())
}

#[test]
fn opens_focuses_and_splits_tabs() {
    let workspace = create_workspace(ids("ws"), 10);
    let opened = open_tab(
        workspace,
        None,
        TabKind::Notifications,
        NewTabIds {
            tab_id: "note".into(),
        },
        11,
    );
    assert_eq!(opened.focused_tab_id.as_deref(), Some("note"));
    assert_eq!(opened.tabs.len(), 2);

    let focused = focus_tab(opened, "ws-pane", "ws-tab", 12);
    assert_eq!(focused.focused_tab_id.as_deref(), Some("ws-tab"));

    let split = split_focused_pane(
        focused,
        SplitDirection::Horizontal,
        NewPaneIds {
            pane_id: "split-pane".into(),
            group_id: "split-group".into(),
            tab_id: "split-tab".into(),
            split_id: "split-root".into(),
        },
        13,
    );
    assert_eq!(split.focused_pane_id.as_deref(), Some("split-pane"));
    assert!(matches!(split.layout, Some(LayoutNode::Split(_))));
}

#[test]
fn converts_new_tab_choices_without_replacing_the_tab_id() -> Result<(), &'static str> {
    let workspace = create_workspace(ids("ws"), 10);
    let converted = convert_tab(
        workspace,
        "ws-pane",
        "ws-tab",
        TabKind::Profile,
        BTreeMap::from([("pubkey".to_owned(), "abc".to_owned())]),
        11,
    );
    let tab = converted
        .tabs
        .get("ws-tab")
        .ok_or("missing converted tab")?;

    assert_eq!(converted.focused_tab_id.as_deref(), Some("ws-tab"));
    assert_eq!(tab.kind, TabKind::Profile);
    assert_eq!(tab.title, "Profile");
    assert_eq!(tab.config.get("pubkey").map(String::as_str), Some("abc"));
    assert_eq!(tab.created_at, 10);
    Ok(())
}

#[test]
fn closes_tabs_and_recovers_final_tile() {
    let workspace = open_tab(
        create_workspace(ids("ws"), 10),
        None,
        TabKind::Settings,
        NewTabIds {
            tab_id: "settings".into(),
        },
        11,
    );
    let closed = close_workspace_tab(workspace, "ws-pane", "settings", ids("recovery"), 12);
    assert_eq!(closed.tabs.len(), 1);
    assert_eq!(closed.focused_tab_id.as_deref(), Some("ws-tab"));

    let recovered = close_workspace_tab(closed, "ws-pane", "ws-tab", ids("fallback"), 13);
    assert_eq!(recovered.tabs.len(), 1);
    assert!(
        recovered
            .tabs
            .values()
            .any(|tab| tab.kind == TabKind::Welcome)
    );
}

#[test]
fn unusable_workspace_recovers_with_source_identity() {
    let mut workspace = create_workspace(ids("ws"), 10);
    workspace.layout = None;
    workspace.focused_pane_id = None;
    workspace.focused_tab_id = None;

    let recovered = ensure_usable_workspace(workspace, ids("fallback"), 11);

    assert_eq!(recovered.id, "ws");
    assert!(
        recovered
            .tabs
            .values()
            .any(|tab| tab.kind == TabKind::Welcome)
    );
}

fn ids(prefix: &str) -> WorkspaceIds {
    WorkspaceIds {
        workspace_id: prefix.into(),
        pane_id: format!("{prefix}-pane"),
        group_id: format!("{prefix}-group"),
        tab_id: format!("{prefix}-tab"),
    }
}
