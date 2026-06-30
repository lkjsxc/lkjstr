use lkjstr_storage::{SettingOverrideRecord, StorageOperation, StorageOutcome, setting_record_key};
use serde::Serialize;

use crate::indexed_db::database::{self, LEGACY_INDEXED_DB_NAME, SETTINGS_TABLE};
use crate::indexed_db::settings_requests;

pub async fn default_setting_put(row: &SettingOverrideRecord) -> StorageOutcome<()> {
    setting_put(LEGACY_INDEXED_DB_NAME, row).await
}

pub async fn setting_put(db_name: &str, row: &SettingOverrideRecord) -> StorageOutcome<()> {
    let operation_id = format!("setting-put-{}", setting_record_key(row));
    let db = match database::open_database(
        db_name,
        StorageOperation::Write,
        SETTINGS_TABLE,
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
            return database::corrupt(StorageOperation::Write, SETTINGS_TABLE, operation_id);
        }
    };
    let result = settings_requests::write_put(&db, value, operation_id).await;
    db.close();
    result
}

pub async fn setting_delete(db_name: &str, key: &str) -> StorageOutcome<()> {
    let operation_id = format!("setting-delete-{key}");
    let db = match database::open_database(
        db_name,
        StorageOperation::Write,
        SETTINGS_TABLE,
        operation_id.clone(),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_| ()),
    };
    let result = settings_requests::write_delete(&db, key, operation_id).await;
    db.close();
    result
}

pub async fn setting_get(
    db_name: &str,
    key: &str,
) -> StorageOutcome<Option<SettingOverrideRecord>> {
    let operation_id = format!("setting-get-{key}");
    let value = match settings_requests::read_value(db_name, key, operation_id.clone()).await {
        StorageOutcome::Ok(value) => value,
        outcome => return outcome.map(|_| None),
    };
    if value.is_undefined() {
        return StorageOutcome::Ok(None);
    }
    settings_requests::deserialize_setting(value, operation_id).map(Some)
}

pub async fn settings_all(db_name: &str) -> StorageOutcome<Vec<SettingOverrideRecord>> {
    let operation_id = "settings-all".to_owned();
    settings_requests::all_records(db_name, operation_id).await
}
