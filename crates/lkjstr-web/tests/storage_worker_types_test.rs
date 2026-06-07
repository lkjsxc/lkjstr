#![cfg(target_arch = "wasm32")]

use lkjstr_web::storage_worker::{StorageOp, StorageResponse};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn storage_worker_health_op_uses_worker_protocol_name() -> Result<(), serde_json::Error> {
    let value = serde_json::to_value(StorageOp::GetStorageHealth)?;

    assert_eq!(value, serde_json::json!({ "kind": "get-storage-health" }));
    Ok(())
}

#[wasm_bindgen_test]
fn storage_worker_response_decodes_health_diagnostics() -> Result<(), serde_json::Error> {
    let response = serde_json::from_value::<StorageResponse>(serde_json::json!({
        "requestId": "health-1",
        "outcome": "ok",
        "rows": [],
        "rowsAffected": 0,
        "diagnostics": {
            "health": {
                "mode": "persistent-opfs",
                "vfsName": "opfs-sahpool",
                "workerKind": "dedicated",
                "sqliteVersion": "3.test",
                "databaseName": "/lkjstr/main.sqlite3",
                "appliedSchemaChanges": ["schema"],
                "pageCount": 2,
                "pageSize": 4096,
                "freelistCount": 0,
                "eventCount": 3,
                "relayReceiptCount": 4,
                "tagRowCount": 5,
                "lastIntegrityCheckAt": null,
                "warnings": []
            }
        }
    }))?;

    let Some(health) = response.diagnostics.health else {
        return Err(serde_json::Error::io(std::io::Error::other(
            "missing health",
        )));
    };
    assert_eq!(health.mode, "persistent-opfs");
    assert_eq!(health.relay_receipt_count, 4);
    Ok(())
}
