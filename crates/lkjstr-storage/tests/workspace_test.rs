use lkjstr_domain::{LayoutNode, bootstrap_workspace};
use lkjstr_storage::{WorkspaceRecord, workspace_record_id, workspace_record_json_bytes};
use serde_json::Value;

#[test]
fn workspace_records_use_workspace_identity() {
    let workspace = bootstrap_workspace();

    assert_eq!(workspace_record_id(&workspace), "main");
}

#[test]
fn workspace_records_roundtrip_storage_json() -> Result<(), serde_json::Error> {
    let workspace = bootstrap_workspace();
    let encoded = serde_json::to_value(&workspace)?;
    let decoded: WorkspaceRecord = serde_json::from_value(encoded.clone())?;

    assert_eq!(decoded, workspace);
    assert_eq!(encoded.get("id"), Some(&Value::String("main".to_owned())));
    assert_eq!(
        encoded.get("focusedTabId"),
        Some(&Value::String("bootstrap-welcome-tab".to_owned()))
    );
    assert!(workspace_record_json_bytes(&decoded)? > 0);
    Ok(())
}

#[test]
fn workspace_layout_serializes_with_type_tags() -> Result<(), serde_json::Error> {
    let workspace = bootstrap_workspace();
    assert!(matches!(workspace.layout, Some(LayoutNode::Split(_))));
    let Some(LayoutNode::Split(layout)) = workspace.layout.as_ref() else {
        return Ok(());
    };
    let encoded = serde_json::to_value(layout)?;

    assert_eq!(
        encoded.get("direction"),
        Some(&Value::String("vertical".to_owned()))
    );
    assert_eq!(encoded.get("sizes"), Some(&serde_json::json!([4000, 6000])));
    Ok(())
}
