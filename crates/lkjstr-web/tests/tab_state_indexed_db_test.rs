#![cfg(target_arch = "wasm32")]

use lkjstr_domain::{TabSnapshotPayload, ToolTabSnapshot};
use lkjstr_storage::{
    StorageOutcome, TabStateRecord, WorkspaceRecord, tab_state_id, tab_state_ledger_record,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::indexed_db;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn indexed_db_tab_state_put_writes_snapshot_and_ledger() -> Result<(), JsValue> {
    let db_name = test_db_name("tab-state-transaction");
    let row = tab_state_record();
    let ledger = tab_state_ledger_record(&row).map_err(|_| js_error("ledger create failed"))?;

    assert_ok(indexed_db::tab_state_store::tab_state_put(&db_name, &row).await)?;

    match indexed_db::tab_state_store::tab_state_get(&db_name, &row.id).await {
        StorageOutcome::Ok(Some(loaded)) if loaded == row => {}
        outcome => return Err(outcome_error("tab state get failed", outcome.problem())),
    }
    match indexed_db::tab_state_store::tab_state_ledger_get(&db_name, &ledger.id).await {
        StorageOutcome::Ok(Some(loaded)) if loaded == ledger => Ok(()),
        outcome => Err(outcome_error("ledger get failed", outcome.problem())),
    }
}

#[wasm_bindgen_test(async)]
async fn workspace_startup_loads_tab_snapshots_for_stored_workspace() -> Result<(), JsValue> {
    let db_name = test_db_name("tab-state-startup");
    let workspace = stored_workspace();
    let row = tab_state_record();

    assert_ok(indexed_db::workspace_store::workspace_put(&db_name, &workspace).await)?;
    assert_ok(indexed_db::tab_state_store::tab_state_put(&db_name, &row).await)?;

    let startup = indexed_db::workspace_store::workspace_startup_input(&db_name, 99).await;

    assert_eq!(startup.stored_workspace, Some(workspace));
    assert_eq!(startup.tab_snapshots, vec![row]);
    Ok(())
}

fn stored_workspace() -> WorkspaceRecord {
    lkjstr_domain::bootstrap_workspace()
}

fn tab_state_record() -> TabStateRecord {
    TabStateRecord {
        id: tab_state_id("main", "bootstrap-tweet-tab"),
        workspace_id: "main".to_owned(),
        tab_id: "bootstrap-tweet-tab".to_owned(),
        last_pane_id: Some("bootstrap-main-pane".to_owned()),
        state: TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(24),
            ..ToolTabSnapshot::default()
        }),
        updated_at: 7_200_000,
    }
}

fn assert_ok(outcome: StorageOutcome<()>) -> Result<(), JsValue> {
    match outcome {
        StorageOutcome::Ok(()) => Ok(()),
        other => Err(outcome_error("storage write failed", other.problem())),
    }
}

fn outcome_error(message: &str, problem: Option<&lkjstr_storage::StorageProblem>) -> JsValue {
    match problem {
        Some(problem) => js_error(&format!("{message}: {}", problem.reason)),
        None => js_error(message),
    }
}

fn test_db_name(label: &str) -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-{label}-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
