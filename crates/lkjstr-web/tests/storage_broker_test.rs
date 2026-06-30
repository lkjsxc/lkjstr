#![cfg(target_arch = "wasm32")]

use lkjstr_storage::StorageOutcome;
use lkjstr_web::storage_worker::{StorageOp, StorageWorkerClient};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const BROKER_GLOBAL: &str = "__lkjstrSqliteOpfsBroker";
const PRODUCT_DB_NAME: &str = "/lkjstr/main.sqlite3";
const PRODUCT_WORKER_URL: &str = "/sqlite-opfs-worker.js";

#[wasm_bindgen_test(async)]
async fn app_broker_match_borrows_installed_broker() -> Result<(), JsValue> {
    install_broker(PRODUCT_WORKER_URL, PRODUCT_DB_NAME)?;
    let outcome = StorageWorkerClient::new_app_broker(PRODUCT_WORKER_URL, PRODUCT_DB_NAME).await;
    let client = match outcome {
        StorageOutcome::Ok(client) => client,
        other => return Err(unexpected_outcome("expected ok", &other)),
    };

    let response = client.send(StorageOp::GetStorageHealth, 1_000).await;
    expect_ok(response, "broker send")?;
    clear_broker()
}

#[wasm_bindgen_test(async)]
async fn app_broker_missing_reports_precise_reason() -> Result<(), JsValue> {
    clear_broker()?;
    let outcome = StorageWorkerClient::new_app_broker(PRODUCT_WORKER_URL, PRODUCT_DB_NAME).await;
    expect_unavailable_reason(&outcome, "broker-missing")
}

#[wasm_bindgen_test(async)]
async fn app_broker_key_mismatch_reports_precise_reason() -> Result<(), JsValue> {
    install_broker(PRODUCT_WORKER_URL, "lkjstr")?;
    let outcome = StorageWorkerClient::new_app_broker(PRODUCT_WORKER_URL, PRODUCT_DB_NAME).await;
    expect_unavailable_reason(&outcome, "broker-key-mismatch")?;
    clear_broker()
}

fn install_broker(worker_url: &str, database_name: &str) -> Result<(), JsValue> {
    let broker = js_sys::Object::new();
    set(&broker, "workerUrl", JsValue::from_str(worker_url))?;
    set(&broker, "databaseName", JsValue::from_str(database_name))?;
    set(&broker, "send", send_function().into())?;
    set(&broker, "close", close_function().into())?;
    js_sys::Reflect::set(
        &js_sys::global(),
        &JsValue::from_str(BROKER_GLOBAL),
        &broker,
    )
    .map(|_| ())
}

fn send_function() -> js_sys::Function {
    js_sys::Function::new_with_args(
        "op, options",
        "return Promise.resolve({ requestId: 'broker-test', outcome: 'ok', rows: [], rowsAffected: 0, diagnostics: {} });",
    )
}

fn close_function() -> js_sys::Function {
    js_sys::Function::new_no_args("return Promise.resolve();")
}

fn set(object: &js_sys::Object, key: &str, value: JsValue) -> Result<(), JsValue> {
    js_sys::Reflect::set(object, &JsValue::from_str(key), &value).map(|_| ())
}

fn clear_broker() -> Result<(), JsValue> {
    js_sys::Reflect::delete_property(&js_sys::global(), &JsValue::from_str(BROKER_GLOBAL))
        .map(|_| ())
}

fn expect_ok<T>(outcome: StorageOutcome<T>, label: &str) -> Result<T, JsValue> {
    match outcome {
        StorageOutcome::Ok(value) => Ok(value),
        other => Err(unexpected_outcome(label, &other)),
    }
}

fn expect_unavailable_reason<T>(outcome: &StorageOutcome<T>, reason: &str) -> Result<(), JsValue> {
    let actual = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("ok");
    if matches!(outcome, StorageOutcome::Unavailable(_)) && actual == reason {
        Ok(())
    } else {
        Err(js_sys::Error::new(&format!("expected {reason}, got {actual}")).into())
    }
}

fn unexpected_outcome<T>(label: &str, outcome: &StorageOutcome<T>) -> JsValue {
    let reason = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("ok");
    js_sys::Error::new(&format!("{label}: {reason}")).into()
}
