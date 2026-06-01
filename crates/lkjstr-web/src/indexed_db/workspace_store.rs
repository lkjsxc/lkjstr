use lkjstr_app::{StartupInput, default_recovery_ids};
use lkjstr_storage::{
    StorageOperation, StorageOutcome, TabStateRecord, WorkspaceRecord, workspace_record_id,
};
use serde::Serialize;
use wasm_bindgen::prelude::JsValue;
use web_sys::IdbTransactionMode;

use crate::indexed_db::callbacks;
use crate::indexed_db::database::{self, DEFAULT_DB_NAME, WORKSPACES_TABLE};
use crate::indexed_db::tab_state_store;

pub async fn default_workspace_startup_input(now: u64) -> StartupInput {
    workspace_startup_input(DEFAULT_DB_NAME, now).await
}

pub async fn workspace_startup_input(db_name: &str, now: u64) -> StartupInput {
    match workspace_get(db_name, "main").await {
        StorageOutcome::Ok(stored_workspace) => {
            let tab_snapshots = startup_tab_snapshots(db_name, stored_workspace.as_ref()).await;
            StartupInput {
                stored_workspace,
                storage_available: true,
                tab_snapshots,
                recovery_ids: default_recovery_ids("main"),
                now,
            }
        }
        _ => StartupInput {
            stored_workspace: None,
            storage_available: false,
            tab_snapshots: Vec::new(),
            recovery_ids: default_recovery_ids("main"),
            now,
        },
    }
}

async fn startup_tab_snapshots(
    db_name: &str,
    workspace: Option<&WorkspaceRecord>,
) -> Vec<TabStateRecord> {
    let Some(workspace) = workspace else {
        return Vec::new();
    };
    match tab_state_store::tab_states_for_workspace(db_name, &workspace.id).await {
        StorageOutcome::Ok(rows) => rows,
        _ => Vec::new(),
    }
}

pub async fn workspace_put(db_name: &str, row: &WorkspaceRecord) -> StorageOutcome<()> {
    let operation_id = format!("workspace-put-{}", workspace_record_id(row));
    let db = match database::open_database(
        db_name,
        StorageOperation::Write,
        WORKSPACES_TABLE,
        operation_id.clone(),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| ()),
    };
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    let value = match row.serialize(&serializer) {
        Ok(value) => value,
        Err(_) => {
            db.close();
            return database::corrupt(StorageOperation::Write, WORKSPACES_TABLE, operation_id);
        }
    };
    let result = match put_value(&db, value, operation_id).await {
        StorageOutcome::Ok(()) => StorageOutcome::Ok(()),
        outcome => outcome,
    };
    db.close();
    result
}

pub async fn workspace_get(db_name: &str, id: &str) -> StorageOutcome<Option<WorkspaceRecord>> {
    let operation_id = format!("workspace-get-{id}");
    let db = match database::open_database(
        db_name,
        StorageOperation::Read,
        WORKSPACES_TABLE,
        operation_id.clone(),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| None),
    };
    let result = get_value(&db, id, operation_id).await;
    db.close();
    result
}

async fn put_value(
    db: &web_sys::IdbDatabase,
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<()> {
    let store = match database::object_store(db, WORKSPACES_TABLE, IdbTransactionMode::Readwrite) {
        Ok(store) => store,
        Err(error) => {
            return database::map_js_error(
                StorageOperation::Write,
                WORKSPACES_TABLE,
                operation_id,
                error,
            );
        }
    };
    let request = match store.put(&value) {
        Ok(request) => request,
        Err(error) => {
            return database::map_js_error(
                StorageOperation::Write,
                WORKSPACES_TABLE,
                operation_id,
                error,
            );
        }
    };
    match callbacks::request_value(request).await {
        Ok(_) => StorageOutcome::Ok(()),
        Err(error) => database::map_js_error(
            StorageOperation::Write,
            WORKSPACES_TABLE,
            operation_id,
            error,
        ),
    }
}

async fn get_value(
    db: &web_sys::IdbDatabase,
    id: &str,
    operation_id: String,
) -> StorageOutcome<Option<WorkspaceRecord>> {
    let store = match database::object_store(db, WORKSPACES_TABLE, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => {
            return database::map_js_error(
                StorageOperation::Read,
                WORKSPACES_TABLE,
                operation_id,
                error,
            );
        }
    };
    let request = match store.get(&JsValue::from_str(id)) {
        Ok(request) => request,
        Err(error) => {
            return database::map_js_error(
                StorageOperation::Read,
                WORKSPACES_TABLE,
                operation_id,
                error,
            );
        }
    };
    match callbacks::request_value(request).await {
        Ok(value) if value.is_undefined() => StorageOutcome::Ok(None),
        Ok(value) => deserialize_workspace(value, operation_id),
        Err(error) => database::map_js_error(
            StorageOperation::Read,
            WORKSPACES_TABLE,
            operation_id,
            error,
        ),
    }
}

fn deserialize_workspace(
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<Option<WorkspaceRecord>> {
    match serde_wasm_bindgen::from_value(value) {
        Ok(row) => StorageOutcome::Ok(Some(row)),
        Err(_) => database::corrupt(StorageOperation::Read, WORKSPACES_TABLE, operation_id),
    }
}
