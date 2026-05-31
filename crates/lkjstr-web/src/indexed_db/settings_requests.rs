use lkjstr_storage::{SettingOverrideRecord, StorageOperation, StorageOutcome};
use wasm_bindgen::{JsCast, prelude::JsValue};
use web_sys::IdbTransactionMode;

use crate::indexed_db::callbacks;
use crate::indexed_db::database::{self, SETTINGS_TABLE};

pub async fn write_put(
    db: &web_sys::IdbDatabase,
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<()> {
    write_request(db, store_put_request, value, operation_id).await
}

pub async fn write_delete(
    db: &web_sys::IdbDatabase,
    key: &str,
    operation_id: String,
) -> StorageOutcome<()> {
    write_request(
        db,
        store_delete_request,
        JsValue::from_str(key),
        operation_id,
    )
    .await
}

pub async fn read_value(db_name: &str, key: &str, operation_id: String) -> StorageOutcome<JsValue> {
    let db = match database::open_database(
        db_name,
        StorageOperation::Read,
        SETTINGS_TABLE,
        operation_id.clone(),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| JsValue::UNDEFINED),
    };
    let result = get_value(&db, key, operation_id).await;
    db.close();
    result
}

pub async fn all_records(
    db_name: &str,
    operation_id: String,
) -> StorageOutcome<Vec<SettingOverrideRecord>> {
    let db = match database::open_database(
        db_name,
        StorageOperation::Read,
        SETTINGS_TABLE,
        operation_id.clone(),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let result = all_values(&db, operation_id).await;
    db.close();
    result
}

pub fn deserialize_setting(
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<SettingOverrideRecord> {
    match serde_wasm_bindgen::from_value(value) {
        Ok(row) => StorageOutcome::Ok(row),
        Err(_) => database::corrupt(StorageOperation::Read, SETTINGS_TABLE, operation_id),
    }
}

async fn get_value(
    db: &web_sys::IdbDatabase,
    key: &str,
    operation_id: String,
) -> StorageOutcome<JsValue> {
    let store = match database::object_store(db, SETTINGS_TABLE, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => return read_error(operation_id, error),
    };
    let request = match store.get(&JsValue::from_str(key)) {
        Ok(request) => request,
        Err(error) => return read_error(operation_id, error),
    };
    match callbacks::request_value(request).await {
        Ok(value) => StorageOutcome::Ok(value),
        Err(error) => read_error(operation_id, error),
    }
}

async fn all_values(
    db: &web_sys::IdbDatabase,
    operation_id: String,
) -> StorageOutcome<Vec<SettingOverrideRecord>> {
    let store = match database::object_store(db, SETTINGS_TABLE, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => return read_error(operation_id, error),
    };
    let request = match store.get_all() {
        Ok(request) => request,
        Err(error) => return read_error(operation_id, error),
    };
    match callbacks::request_value(request).await {
        Ok(value) => deserialize_settings(value, operation_id),
        Err(error) => read_error(operation_id, error),
    }
}

async fn write_request(
    db: &web_sys::IdbDatabase,
    request: fn(&web_sys::IdbObjectStore, &JsValue) -> Result<web_sys::IdbRequest, JsValue>,
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<()> {
    let store = match database::object_store(db, SETTINGS_TABLE, IdbTransactionMode::Readwrite) {
        Ok(store) => store,
        Err(error) => return write_error(operation_id, error),
    };
    let request = match request(&store, &value) {
        Ok(request) => request,
        Err(error) => return write_error(operation_id, error),
    };
    match callbacks::request_value(request).await {
        Ok(_) => StorageOutcome::Ok(()),
        Err(error) => write_error(operation_id, error),
    }
}

fn deserialize_settings(
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<Vec<SettingOverrideRecord>> {
    let Ok(array) = value.dyn_into::<js_sys::Array>() else {
        return database::corrupt(StorageOperation::Read, SETTINGS_TABLE, operation_id);
    };
    let mut rows = Vec::new();
    for value in array.iter() {
        match deserialize_setting(value, operation_id.clone()) {
            StorageOutcome::Ok(row) => rows.push(row),
            outcome => return outcome.map(|_| Vec::new()),
        }
    }
    StorageOutcome::Ok(rows)
}

fn store_put_request(
    store: &web_sys::IdbObjectStore,
    value: &JsValue,
) -> Result<web_sys::IdbRequest, JsValue> {
    store.put(value)
}

fn store_delete_request(
    store: &web_sys::IdbObjectStore,
    value: &JsValue,
) -> Result<web_sys::IdbRequest, JsValue> {
    store.delete(value)
}

fn read_error<T>(operation_id: String, error: JsValue) -> StorageOutcome<T> {
    database::map_js_error(StorageOperation::Read, SETTINGS_TABLE, operation_id, error)
}

fn write_error<T>(operation_id: String, error: JsValue) -> StorageOutcome<T> {
    database::map_js_error(StorageOperation::Write, SETTINGS_TABLE, operation_id, error)
}
