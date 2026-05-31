use std::collections::BTreeMap;

use lkjstr_app::{
    StartupInput, StartupSource, convert_runtime_tab, default_recovery_ids,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};
use lkjstr_domain::{
    NewTabIds, TabKind, TabSnapshotPayload, ToolTabSnapshot, WorkspaceTab, bootstrap_workspace,
};
use lkjstr_storage::tab_state_id;

#[test]
fn starts_from_bootstrap_when_storage_has_no_workspace() {
    let result = start_workspace(StartupInput {
        stored_workspace: None,
        storage_available: true,
        recovery_ids: default_recovery_ids("main"),
        now: 7,
    });

    assert_eq!(result.source, StartupSource::Bootstrap);
    assert_eq!(
        result.state.workspace.focused_tab_id.as_deref(),
        Some("bootstrap-welcome-tab")
    );
    assert_eq!(result.state.workspace.tabs.len(), 6);
}

#[test]
fn recovers_to_welcome_when_storage_is_unavailable() {
    let result = start_workspace(StartupInput {
        stored_workspace: Some(bootstrap_workspace()),
        storage_available: false,
        recovery_ids: default_recovery_ids("main"),
        now: 7,
    });

    assert_eq!(result.source, StartupSource::StorageUnavailable);
    assert_eq!(
        result.state.workspace.focused_tab_id.as_deref(),
        Some("recovered-welcome-tab")
    );
    assert_eq!(result.state.workspace.tabs.len(), 1);
}

#[test]
fn repairs_unusable_stored_workspace() {
    let mut broken = bootstrap_workspace();
    broken.layout = None;

    let result = start_workspace(StartupInput {
        stored_workspace: Some(broken),
        storage_available: true,
        recovery_ids: default_recovery_ids("main"),
        now: 7,
    });

    assert_eq!(result.source, StartupSource::Recovered);
    assert_eq!(
        result.state.workspace.focused_tab_id.as_deref(),
        Some("recovered-welcome-tab")
    );
}

#[test]
fn opens_tabs_through_runtime_reducer() {
    let state = start_workspace(StartupInput {
        stored_workspace: None,
        storage_available: true,
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    })
    .state;

    let state = open_runtime_tab(
        state,
        Some("bootstrap-welcome-pane"),
        TabKind::Search,
        NewTabIds {
            tab_id: "search-tab".to_owned(),
        },
        9,
    );

    assert_eq!(
        state.workspace.focused_tab_id.as_deref(),
        Some("search-tab")
    );
    assert_eq!(
        state.workspace.tabs.get("search-tab"),
        Some(&WorkspaceTab::new("search-tab", TabKind::Search, 9))
    );
}

#[test]
fn opens_and_converts_configured_tabs_through_runtime_reducer() -> Result<(), &'static str> {
    let state = start_workspace(StartupInput {
        stored_workspace: None,
        storage_available: true,
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    })
    .state;
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
    assert_eq!(
        state.workspace.focused_tab_id.as_deref(),
        Some("profile-tab")
    );
    Ok(())
}

#[test]
fn records_bounded_tab_snapshots() {
    let mut state = start_workspace(StartupInput {
        stored_workspace: None,
        storage_available: true,
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    })
    .state;
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
