use std::collections::BTreeMap;

use lkjstr_app::{
    StartupInput, StartupSource, convert_runtime_tab, default_recovery_ids,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};
use lkjstr_domain::{
    NewTabIds, TabKind, TabSnapshotPayload, ToolTabSnapshot, Workspace, WorkspaceTab,
    bootstrap_workspace,
};
use lkjstr_storage::{TabStateRecord, tab_state_id};

#[test]
fn starts_from_bootstrap_when_storage_has_no_workspace() {
    let result = start_workspace(startup_input(None, true, Vec::new()));

    assert_eq!(result.source, StartupSource::Bootstrap);
    assert_focused(&result.state.workspace, "bootstrap-welcome-tab");
    assert_eq!(result.state.workspace.tabs.len(), 6);
}

#[test]
fn recovers_to_welcome_when_storage_is_unavailable() {
    let result = start_workspace(startup_input(
        Some(bootstrap_workspace()),
        false,
        Vec::new(),
    ));

    assert_eq!(result.source, StartupSource::StorageUnavailable);
    assert_focused(&result.state.workspace, "recovered-welcome-tab");
    assert_eq!(result.state.workspace.tabs.len(), 1);
}

#[test]
fn repairs_unusable_stored_workspace() {
    let mut broken = bootstrap_workspace();
    broken.layout = None;

    let result = start_workspace(startup_input(Some(broken), true, Vec::new()));

    assert_eq!(result.source, StartupSource::Recovered);
    assert_focused(&result.state.workspace, "recovered-welcome-tab");
}

#[test]
fn opens_tabs_through_runtime_reducer() {
    let state = start_workspace(startup_input(None, true, Vec::new())).state;

    let state = open_runtime_tab(
        state,
        Some("bootstrap-welcome-pane"),
        TabKind::Search,
        NewTabIds {
            tab_id: "search-tab".to_owned(),
        },
        9,
    );

    assert_focused(&state.workspace, "search-tab");
    assert_eq!(
        state.workspace.tabs.get("search-tab"),
        Some(&WorkspaceTab::new("search-tab", TabKind::Search, 9))
    );
}

#[test]
fn opens_and_converts_configured_tabs_through_runtime_reducer() -> Result<(), &'static str> {
    let state = start_workspace(startup_input(None, true, Vec::new())).state;
    let state = open_configured_runtime_tab(
        state,
        Some("bootstrap-welcome-pane"),
        TabKind::Profile,
        NewTabIds {
            tab_id: "profile-tab".to_owned(),
        },
        BTreeMap::from([("pubkey".to_owned(), "abc".to_owned())]),
        9,
    );
    let state = convert_runtime_tab(
        state,
        "bootstrap-welcome-pane",
        "profile-tab",
        TabKind::Tweet,
        BTreeMap::new(),
        10,
    );
    let tab = state
        .workspace
        .tabs
        .get("profile-tab")
        .ok_or("missing converted runtime tab")?;

    assert_eq!(tab.kind, TabKind::Tweet);
    assert!(tab.config.is_empty());
    assert_focused(&state.workspace, "profile-tab");
    Ok(())
}

#[test]
fn records_bounded_tab_snapshots() {
    let mut state = start_workspace(startup_input(None, true, Vec::new())).state;
    state.warm_snapshot_cap = 2;

    for (tab_id, now) in [
        ("bootstrap-home-tab", 1),
        ("bootstrap-notifications-tab", 2),
        ("bootstrap-tweet-tab", 3),
    ] {
        state = record_tab_snapshot(
            state,
            Some("bootstrap-main-pane"),
            tab_id,
            TabSnapshotPayload::Tool(ToolTabSnapshot {
                scroll_top: Some(now),
                ..ToolTabSnapshot::default()
            }),
            now as u64,
        );
    }

    assert_eq!(
        state.warm_tab_order,
        vec![
            "bootstrap-notifications-tab".to_owned(),
            "bootstrap-tweet-tab".to_owned()
        ]
    );
    assert!(
        !state
            .tab_snapshots
            .contains_key(&tab_state_id("main", "bootstrap-home-tab"))
    );
    assert!(
        state
            .tab_snapshots
            .contains_key(&tab_state_id("main", "bootstrap-tweet-tab"))
    );
}

#[test]
fn restores_valid_startup_tab_snapshots() {
    let newest = snapshot("bootstrap-tweet-tab", 22);
    let stale = snapshot("missing-tab", 30);

    let state = start_workspace(startup_input(
        Some(bootstrap_workspace()),
        true,
        vec![stale, newest.clone()],
    ))
    .state;

    assert_eq!(state.warm_tab_order, vec!["bootstrap-tweet-tab"]);
    assert_eq!(
        state
            .tab_snapshots
            .get(&tab_state_id("main", "bootstrap-tweet-tab")),
        Some(&newest)
    );
    assert!(
        !state
            .tab_snapshots
            .contains_key(&tab_state_id("main", "missing-tab"))
    );
}

fn startup_input(
    stored_workspace: Option<Workspace>,
    storage_available: bool,
    tab_snapshots: Vec<TabStateRecord>,
) -> StartupInput {
    StartupInput {
        stored_workspace,
        storage_available,
        tab_snapshots,
        recovery_ids: default_recovery_ids("main"),
        now: 7,
    }
}

fn snapshot(tab_id: &str, now: u64) -> TabStateRecord {
    TabStateRecord {
        id: tab_state_id("main", tab_id),
        workspace_id: "main".to_owned(),
        tab_id: tab_id.to_owned(),
        last_pane_id: Some("bootstrap-main-pane".to_owned()),
        state: TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(now.min(i64::MAX as u64) as i64),
            ..ToolTabSnapshot::default()
        }),
        updated_at: now,
    }
}

fn assert_focused(workspace: &Workspace, tab_id: &str) {
    assert_eq!(workspace.focused_tab_id.as_deref(), Some(tab_id));
}
