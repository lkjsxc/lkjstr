use serde::de::DeserializeOwned;
use wasm_bindgen::{JsCast, prelude::JsValue};
use web_sys::{IdbDatabase, IdbTransactionMode};

use lkjstr_storage::{StorageOperation, StorageOutcome};

use crate::indexed_db::{callbacks, database};

pub async fn get<T: DeserializeOwned>(
    db_name: &str,
    table: &'static str,
    key: &str,
) -> StorageOutcome<Option<T>> {
    let operation_id = format!("{table}-get-{key}");
    match read_value(db_name, table, key, operation_id.clone()).await {
        StorageOutcome::Ok(value) if value.is_undefined() => StorageOutcome::Ok(None),
        StorageOutcome::Ok(value) => deserialize(value, table, operation_id).map(Some),
        outcome => outcome.map(|_| None),
    }
}

pub async fn all_values(
    db_name: &str,
    table: &'static str,
    operation_id: String,
) -> StorageOutcome<Vec<JsValue>> {
    let db = match open(db_name, StorageOperation::Read, table, operation_id.clone()).await {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let result = read_all_values(&db, table, operation_id).await;
    db.close();
    result
}

pub fn deserialize<T: DeserializeOwned>(
    value: JsValue,
    table: &'static str,
    operation_id: String,
) -> StorageOutcome<T> {
    match serde_wasm_bindgen::from_value(value) {
        Ok(row) => StorageOutcome::Ok(row),
        Err(_) => database::corrupt(StorageOperation::Read, table, operation_id),
    }
}

async fn open(
    db_name: &str,
    operation: StorageOperation,
    table: &'static str,
    operation_id: String,
) -> StorageOutcome<IdbDatabase> {
    database::open_database(db_name, operation, table, operation_id).await
}

async fn read_value(
    db_name: &str,
    table: &'static str,
    key: &str,
    operation_id: String,
) -> StorageOutcome<JsValue> {
    let db = match open(db_name, StorageOperation::Read, table, operation_id.clone()).await {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| JsValue::UNDEFINED),
    };
    let store = match database::object_store(&db, table, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => {
            db.close();
            return map_read(table, operation_id, error);
        }
    };
    let request = match store.get(&JsValue::from_str(key)) {
        Ok(request) => request,
        Err(error) => {
            db.close();
            return map_read(table, operation_id, error);
        }
    };
    let result = callbacks::request_value(request).await.map_or_else(
        |error| map_read(table, operation_id, error),
        StorageOutcome::Ok,
    );
    db.close();
    result
}

async fn read_all_values(
    db: &IdbDatabase,
    table: &'static str,
    operation_id: String,
) -> StorageOutcome<Vec<JsValue>> {
    let store = match database::object_store(db, table, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => return map_read(table, operation_id, error),
    };
    let request = match store.get_all() {
        Ok(request) => request,
        Err(error) => return map_read(table, operation_id, error),
    };
    match callbacks::request_value(request).await {
        Ok(value) => values_from_array(value, table, operation_id),
        Err(error) => map_read(table, operation_id, error),
    }
}

fn values_from_array(
    value: JsValue,
    table: &'static str,
    operation_id: String,
) -> StorageOutcome<Vec<JsValue>> {
    let Ok(array) = value.dyn_into::<js_sys::Array>() else {
        return database::corrupt(StorageOperation::Read, table, operation_id);
    };
    StorageOutcome::Ok(array.iter().collect())
}

fn map_read<T>(table: &'static str, operation_id: String, error: JsValue) -> StorageOutcome<T> {
    database::map_js_error(StorageOperation::Read, table, operation_id, error)
}
