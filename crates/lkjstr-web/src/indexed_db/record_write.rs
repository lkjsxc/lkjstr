use serde::Serialize;
use wasm_bindgen::prelude::JsValue;
use web_sys::{IdbDatabase, IdbObjectStore, IdbRequest, IdbTransactionMode};

use lkjstr_storage::{StorageOperation, StorageOutcome};

use crate::indexed_db::{callbacks, database};

pub async fn put<T: Serialize>(
    db_name: &str,
    table: &'static str,
    key: &str,
    row: &T,
) -> StorageOutcome<()> {
    let operation_id = format!("{table}-put-{key}");
    let db = match open(db_name, table, operation_id.clone()).await {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| ()),
    };
    let value = match serialize(row) {
        Ok(value) => value,
        Err(_) => {
            db.close();
            return database::corrupt(StorageOperation::Write, table, operation_id);
        }
    };
    let result = write(&db, table, store_put_request, value, operation_id).await;
    db.close();
    result
}

pub async fn delete(db_name: &str, table: &'static str, key: &str) -> StorageOutcome<()> {
    let operation_id = format!("{table}-delete-{key}");
    let db = match open(db_name, table, operation_id.clone()).await {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| ()),
    };
    let result = write(
        &db,
        table,
        store_delete_request,
        JsValue::from_str(key),
        operation_id,
    )
    .await;
    db.close();
    result
}

async fn open(
    db_name: &str,
    table: &'static str,
    operation_id: String,
) -> StorageOutcome<IdbDatabase> {
    database::open_database(db_name, StorageOperation::Write, table, operation_id).await
}

async fn write(
    db: &IdbDatabase,
    table: &'static str,
    request: fn(&IdbObjectStore, &JsValue) -> Result<IdbRequest, JsValue>,
    value: JsValue,
    operation_id: String,
) -> StorageOutcome<()> {
    let store = match database::object_store(db, table, IdbTransactionMode::Readwrite) {
        Ok(store) => store,
        Err(error) => return map_write(table, operation_id, error),
    };
    let request = match request(&store, &value) {
        Ok(request) => request,
        Err(error) => return map_write(table, operation_id, error),
    };
    callbacks::request_value(request).await.map_or_else(
        |error| map_write(table, operation_id, error),
        |_| StorageOutcome::Ok(()),
    )
}

fn serialize<T: Serialize>(row: &T) -> Result<JsValue, serde_wasm_bindgen::Error> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    row.serialize(&serializer)
}

fn store_put_request(store: &IdbObjectStore, value: &JsValue) -> Result<IdbRequest, JsValue> {
    store.put(value)
}

fn store_delete_request(store: &IdbObjectStore, value: &JsValue) -> Result<IdbRequest, JsValue> {
    store.delete(value)
}

fn map_write<T>(table: &'static str, operation_id: String, error: JsValue) -> StorageOutcome<T> {
    database::map_js_error(StorageOperation::Write, table, operation_id, error)
}
