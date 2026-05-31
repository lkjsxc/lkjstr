use lkjstr_domain::{TabSnapshotPayload, ToolTabSnapshot};
use lkjstr_storage::{
    CacheOwnerKind, CacheResourceKind, TabStateRecord, tab_state_id, tab_state_ledger_record,
};
use serde_json::json;

#[test]
fn tab_state_ids_use_workspace_and_tab() {
    assert_eq!(tab_state_id("workspace", "tab"), "workspace:tab");
}

#[test]
fn tab_state_rows_create_ledger_records() -> Result<(), serde_json::Error> {
    let id = tab_state_id("workspace", "tab");
    let row = TabStateRecord {
        id: id.clone(),
        workspace_id: "workspace".to_owned(),
        tab_id: "tab".to_owned(),
        last_pane_id: Some("pane".to_owned()),
        state: TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(12),
            ..ToolTabSnapshot::default()
        }),
        updated_at: 3_600_000,
    };

    let ledger = tab_state_ledger_record(&row)?;

    assert_eq!(ledger.id, "tab-snapshot:workspace:tab");
    assert_eq!(ledger.owner_kind, CacheOwnerKind::TabSnapshot);
    assert_eq!(ledger.resource_kind, CacheResourceKind::TabState);
    assert_eq!(ledger.resource_id, id);
    assert_eq!(ledger.score, 51);
    assert!(!ledger.protected);
    assert_eq!(ledger.reason.as_deref(), Some("tab-snapshot"));
    assert!(ledger.cache_bytes > 0);
    Ok(())
}

#[test]
fn tab_state_rows_roundtrip_storage_json() -> Result<(), serde_json::Error> {
    let row = TabStateRecord {
        id: "workspace:tab".to_owned(),
        workspace_id: "workspace".to_owned(),
        tab_id: "tab".to_owned(),
        last_pane_id: None,
        state: TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(12),
            ..ToolTabSnapshot::default()
        }),
        updated_at: 42,
    };

    let encoded = serde_json::to_value(&row)?;

    assert_eq!(
        encoded,
        json!({
            "id": "workspace:tab",
            "workspaceId": "workspace",
            "tabId": "tab",
            "state": { "kind": "tool", "scrollTop": 12 },
            "updatedAt": 42
        })
    );
    assert_eq!(serde_json::from_value::<TabStateRecord>(encoded)?, row);
    Ok(())
}
