use lkjstr_storage::{StorageOperation, StorageOutcome};
use serde::Serialize;
use wasm_bindgen::prelude::JsValue;
use web_sys::{IdbDatabase, IdbTransaction, IdbTransactionMode};

use crate::indexed_db::{database, transaction_events};

pub struct TransactionPut {
    table: &'static str,
    value: JsValue,
}

pub fn put_record<T: Serialize>(table: &'static str, row: &T) -> Result<TransactionPut, JsValue> {
    serialize(row).map(|value| TransactionPut { table, value })
}

pub async fn put_records(
    db_name: &str,
    table: &'static str,
    operation_id: String,
    records: Vec<TransactionPut>,
) -> StorageOutcome<()> {
    if records.is_empty() {
        return StorageOutcome::Ok(());
    }
    let db = match database::open_database(
        db_name,
        StorageOperation::Transaction,
        table,
        operation_id.clone(),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| ()),
    };
    let result = put_records_in_db(&db, table, operation_id, &records).await;
    db.close();
    result
}

async fn put_records_in_db(
    db: &IdbDatabase,
    table: &'static str,
    operation_id: String,
    records: &[TransactionPut],
) -> StorageOutcome<()> {
    let idb_transaction = match transaction_for_records(db, records) {
        Ok(idb_transaction) => idb_transaction,
        Err(error) => return map_transaction(table, operation_id, error),
    };
    let wait = transaction_events::transaction_result(idb_transaction.clone());
    if let Err(error) = queue_puts(&idb_transaction, records) {
        let _result = idb_transaction.abort();
        let _settled = wait.await;
        return map_transaction(table, operation_id, error);
    }
    wait.await.map_or_else(
        |error| map_transaction(table, operation_id, error),
        |_| StorageOutcome::Ok(()),
    )
}

fn transaction_for_records(
    db: &IdbDatabase,
    records: &[TransactionPut],
) -> Result<IdbTransaction, JsValue> {
    let names = js_sys::Array::new();
    for record in records {
        names.push(&JsValue::from_str(record.table));
    }
    db.transaction_with_str_sequence_and_mode(names.as_ref(), IdbTransactionMode::Readwrite)
}

fn queue_puts(idb_transaction: &IdbTransaction, records: &[TransactionPut]) -> Result<(), JsValue> {
    for record in records {
        idb_transaction
            .object_store(record.table)?
            .put(&record.value)
            .map(|_request| ())?;
    }
    Ok(())
}

fn serialize<T: Serialize>(row: &T) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    row.serialize(&serializer)
        .map_err(|_error| JsValue::from_str("corrupt"))
}

fn map_transaction<T>(
    table: &'static str,
    operation_id: String,
    error: JsValue,
) -> StorageOutcome<T> {
    database::map_js_error(StorageOperation::Transaction, table, operation_id, error)
}
