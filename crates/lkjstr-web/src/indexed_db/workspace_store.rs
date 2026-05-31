use lkjstr_app::{StartupInput, default_recovery_ids};
use lkjstr_storage::{StorageOperation, StorageOutcome, WorkspaceRecord, workspace_record_id};
use serde::Serialize;
use wasm_bindgen::prelude::JsValue;
use web_sys::IdbTransactionMode;

use crate::indexed_db::callbacks;
use crate::indexed_db::database::{self, DEFAULT_DB_NAME, WORKSPACES_TABLE};

pub async fn default_workspace_startup_input(now: u64) -> StartupInput {
    workspace_startup_input(DEFAULT_DB_NAME, now).await
}

pub async fn workspace_startup_input(db_name: &str, now: u64) -> StartupInput {
    match workspace_get(db_name, "main").await {
        StorageOutcome::Ok(stored_workspace) => StartupInput {
            stored_workspace,
            storage_available: true,
            recovery_ids: default_recovery_ids("main"),
            now,
        },
        _ => StartupInput {
            stored_workspace: None,
            storage_available: false,
            recovery_ids: default_recovery_ids("main"),
            now,
        },
    }
}

pub async fn workspace_put(db_name: &str, row: &WorkspaceRecord) -> StorageOutcome<()> {
    let operation_id = format!("workspace-put-{}", workspace_record_id(row));
    let db = match database::open_database(db_name, StorageOperation::Write, operation_id.clone())
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
            return database::corrupt(StorageOperation::Write, operation_id);
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
    let db = match database::open_database(db_name, StorageOperation::Read, operation_id.clone())
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
        Err(error) => return database::map_js_error(StorageOperation::Write, operation_id, error),
    };
    let request = match store.put(&value) {
        Ok(request) => request,
        Err(error) => return database::map_js_error(StorageOperation::Write, operation_id, error),
    };
    match callbacks::request_value(request).await {
        Ok(_) => StorageOutcome::Ok(()),
        Err(error) => database::map_js_error(StorageOperation::Write, operation_id, error),
    }
}

async fn get_value(
    db: &web_sys::IdbDatabase,
    id: &str,
    operation_id: String,
) -> StorageOutcome<Option<WorkspaceRecord>> {
    let store = match database::object_store(db, WORKSPACES_TABLE, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => return database::map_js_error(StorageOperation::Read, operation_id, error),
    };
    let request = match store.get(&JsValue::from_str(id)) {
        Ok(request) => request,
        Err(error) => return database::map_js_error(StorageOperation::Read, operation_id, error),
    };
    match callbacks::request_value(request).await {
        Ok(value) if value.is_undefined() => StorageOutcome::Ok(None),
        Ok(value) => deserialize_workspace(value, operation_id),
        Err(error) => database::map_js_error(StorageOperation::Read, operation_id, error),
    }
}

fn deserialize_workspace(
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<Option<WorkspaceRecord>> {
    match serde_wasm_bindgen::from_value(value) {
        Ok(row) => StorageOutcome::Ok(Some(row)),
        Err(_) => database::corrupt(StorageOperation::Read, operation_id),
    }
}

trait OutcomeMap<T> {
    fn map<U>(self, value: impl FnOnce(T) -> U) -> StorageOutcome<U>;
}

impl<T> OutcomeMap<T> for StorageOutcome<T> {
    fn map<U>(self, value: impl FnOnce(T) -> U) -> StorageOutcome<U> {
        match self {
            StorageOutcome::Ok(inner) => StorageOutcome::Ok(value(inner)),
            StorageOutcome::Unavailable(problem) => StorageOutcome::Unavailable(problem),
            StorageOutcome::Timeout(problem) => StorageOutcome::Timeout(problem),
            StorageOutcome::Blocked(problem) => StorageOutcome::Blocked(problem),
            StorageOutcome::Quota(problem) => StorageOutcome::Quota(problem),
            StorageOutcome::Corrupt(problem) => StorageOutcome::Corrupt(problem),
            StorageOutcome::LateSettled(problem) => StorageOutcome::LateSettled(problem),
            StorageOutcome::LateRejected(problem) => StorageOutcome::LateRejected(problem),
        }
    }
}
