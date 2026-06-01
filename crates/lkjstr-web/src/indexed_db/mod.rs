pub mod account_store;
mod callbacks;
pub mod database;
pub mod inventory_store;
pub mod local_secret_store;
mod record_requests;
mod record_write;
pub mod relay_set_store;
mod schema;
mod settings_requests;
pub mod settings_store;
mod transaction;
mod transaction_events;
pub mod tweet_draft_store;
pub mod workspace_store;

use lkjstr_storage::{
    SettingOverrideRecord, StorageOperation, StorageOutcome, TweetDraftRecord, WorkspaceRecord,
};
use serde::Serialize;
use wasm_bindgen::prelude::JsValue;

use crate::response;

#[derive(Serialize)]
struct Availability {
    available: bool,
}

pub async fn indexed_db_available_response() -> JsValue {
    let outcome = database::open_database(
        database::DEFAULT_DB_NAME,
        StorageOperation::Read,
        database::WORKSPACES_TABLE,
        "idb-probe",
    )
    .await;
    match outcome {
        StorageOutcome::Ok(db) => {
            db.close();
            response::ok(Availability { available: true })
        }
        other => outcome_error(other),
    }
}

pub async fn workspace_put_json_response(json: &str) -> JsValue {
    let row = match serde_json::from_str::<WorkspaceRecord>(json) {
        Ok(row) => row,
        Err(error) => return response::error("corrupt", error.to_string()),
    };
    match workspace_store::workspace_put(database::DEFAULT_DB_NAME, &row).await {
        StorageOutcome::Ok(()) => response::ok(Availability { available: true }),
        other => outcome_error(other),
    }
}

pub async fn workspace_get_json_response(id: &str) -> JsValue {
    match workspace_store::workspace_get(database::DEFAULT_DB_NAME, id).await {
        StorageOutcome::Ok(row) => response::ok(row),
        other => outcome_error(other),
    }
}

pub async fn setting_put_json_response(json: &str) -> JsValue {
    let row = match serde_json::from_str::<SettingOverrideRecord>(json) {
        Ok(row) => row,
        Err(error) => return response::error("corrupt", error.to_string()),
    };
    match settings_store::setting_put(database::DEFAULT_DB_NAME, &row).await {
        StorageOutcome::Ok(()) => response::ok(Availability { available: true }),
        other => outcome_error(other),
    }
}

pub async fn setting_get_json_response(key: &str) -> JsValue {
    match settings_store::setting_get(database::DEFAULT_DB_NAME, key).await {
        StorageOutcome::Ok(row) => response::ok(row),
        other => outcome_error(other),
    }
}

pub async fn tweet_draft_put_json_response(json: &str) -> JsValue {
    let row = match serde_json::from_str::<TweetDraftRecord>(json) {
        Ok(row) => row,
        Err(error) => return response::error("corrupt", error.to_string()),
    };
    match tweet_draft_store::tweet_draft_put(database::DEFAULT_DB_NAME, &row).await {
        StorageOutcome::Ok(()) => response::ok(Availability { available: true }),
        other => outcome_error(other),
    }
}

pub async fn tweet_draft_get_json_response(id: &str) -> JsValue {
    match tweet_draft_store::tweet_draft_get(database::DEFAULT_DB_NAME, id).await {
        StorageOutcome::Ok(row) => response::ok(row),
        other => outcome_error(other),
    }
}

fn outcome_error<T>(outcome: StorageOutcome<T>) -> JsValue {
    let Some(problem) = outcome.problem() else {
        return response::error("unknown", "storage operation failed");
    };
    response::error(problem.reason, problem.operation_id.clone())
}
