use lkjstr_storage::{
    CURRENT_STORAGE_SCHEMA_STEP, StorageOperation, StorageOutcome, StorageProblem,
};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use web_sys::{
    Event, IdbDatabase, IdbFactory, IdbObjectStore, IdbOpenDbRequest, IdbTransactionMode,
};

use crate::indexed_db::{callbacks, schema};

pub const DEFAULT_DB_NAME: &str = "lkjstr";
pub const WORKSPACES_TABLE: &str = "workspaces";

pub async fn open_database(
    db_name: &str,
    operation: StorageOperation,
    operation_id: impl Into<String>,
) -> StorageOutcome<IdbDatabase> {
    let operation_id = operation_id.into();
    let factory = match indexed_db_factory(operation, &operation_id) {
        Ok(factory) => factory,
        Err(problem) => return StorageOutcome::Unavailable(problem),
    };
    let request = match factory.open_with_u32(db_name, CURRENT_STORAGE_SCHEMA_STEP) {
        Ok(request) => request,
        Err(error) => return map_js_error(operation, operation_id, error),
    };
    let upgrade = upgrade_callback(request.clone());
    match callbacks::open_request_value(request, upgrade).await {
        Ok(value) => database_from_value(operation, operation_id, value),
        Err(error) => map_js_error(operation, operation_id, error),
    }
}

pub fn object_store(
    db: &IdbDatabase,
    table: &'static str,
    mode: IdbTransactionMode,
) -> Result<IdbObjectStore, JsValue> {
    db.transaction_with_str_and_mode(table, mode)?
        .object_store(table)
}

pub fn map_js_error<T>(
    operation: StorageOperation,
    operation_id: String,
    error: JsValue,
) -> StorageOutcome<T> {
    let reason = classify_error(&error);
    let problem = StorageProblem::new(operation, WORKSPACES_TABLE, reason, operation_id);
    match reason {
        "blocked" => StorageOutcome::Blocked(problem),
        "quota" => StorageOutcome::Quota(problem),
        "corrupt" => StorageOutcome::Corrupt(problem),
        "unavailable" => StorageOutcome::Unavailable(problem),
        _ => StorageOutcome::Corrupt(problem),
    }
}

pub fn corrupt<T>(
    operation: StorageOperation,
    operation_id: impl Into<String>,
) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(StorageProblem::new(
        operation,
        WORKSPACES_TABLE,
        "corrupt",
        operation_id,
    ))
}

fn indexed_db_factory(
    operation: StorageOperation,
    operation_id: &str,
) -> Result<IdbFactory, StorageProblem> {
    let Some(window) = web_sys::window() else {
        return Err(unavailable_problem(operation, operation_id));
    };
    match window.indexed_db() {
        Ok(Some(factory)) => Ok(factory),
        Ok(None) | Err(_) => Err(unavailable_problem(operation, operation_id)),
    }
}

fn unavailable_problem(operation: StorageOperation, operation_id: &str) -> StorageProblem {
    StorageProblem::new(operation, WORKSPACES_TABLE, "unavailable", operation_id)
}

fn upgrade_callback(request: IdbOpenDbRequest) -> callbacks::EventSlot {
    callbacks::event_slot(Closure::wrap(Box::new(move |_event: Event| {
        if let Ok(value) = request.result()
            && let Ok(db) = value.dyn_into::<IdbDatabase>()
        {
            let _result = schema::ensure_schema(&db);
        }
    }) as Box<dyn FnMut(_)>))
}

fn database_from_value(
    operation: StorageOperation,
    operation_id: String,
    value: JsValue,
) -> StorageOutcome<IdbDatabase> {
    let Ok(db) = value.dyn_into::<IdbDatabase>() else {
        return corrupt(operation, operation_id);
    };
    if !db.object_store_names().contains(WORKSPACES_TABLE) {
        return corrupt(operation, operation_id);
    }
    StorageOutcome::Ok(db)
}

fn classify_error(error: &JsValue) -> &'static str {
    let text = error.as_string().unwrap_or_default();
    if text.contains("blocked") {
        return "blocked";
    }
    if text.contains("Quota") {
        return "quota";
    }
    if text.contains("InvalidState") || text.contains("NotFound") || text.contains("Version") {
        return "corrupt";
    }
    if text.contains("unavailable") {
        return "unavailable";
    }
    "corrupt"
}
