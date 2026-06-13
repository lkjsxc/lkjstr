#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_domain::{SignerType, create_account};
use lkjstr_storage::{SettingOverrideRecord, active_account_selector_key};
use lkjstr_web::{
    sqlite_store::{
        SqliteStore, sqlite_account_put, sqlite_active_account_selector_get, sqlite_setting_put,
    },
    storage_worker::StorageWorkerClient,
};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;

pub const ACTIVE_KEY: &str = "lkjstr.activeAccountId";
pub const WORKER_URL: &str = "/static/sqlite-opfs-worker.js";

pub async fn store_for(db_name: &str) -> Result<(StorageWorkerClient, SqliteStore), JsValue> {
    let client = client_for(WORKER_URL)?;
    let store = assert_ok(SqliteStore::open(client.clone(), db_name.to_owned(), 1_000).await)?;
    Ok((client, store))
}

pub async fn write_accounts(
    db_name: &str,
    accounts: &[lkjstr_storage::AccountRecord],
) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    for account in accounts {
        assert_ok(sqlite_account_put(&store, account).await)?;
    }
    assert_ok(client.close().await)
}

pub async fn assert_selector(db_name: &str, expected_id: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let row = assert_ok(sqlite_active_account_selector_get(&store).await)?
        .ok_or_else(|| js_error("missing selector"))?;
    assert_eq!(row.selected_account_id.as_deref(), Some(expected_id));
    assert_ok(client.close().await)
}

pub async fn write_bad_selector(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let row = SettingOverrideRecord {
        key: active_account_selector_key().to_owned(),
        namespace: "accounts".to_owned(),
        value: serde_json::json!("bad-selector"),
        updated_at: 15,
    };
    assert_ok(sqlite_setting_put(&store, &row).await)?;
    assert_ok(client.close().await)
}

pub fn account(prefix: &str, timestamp: u64) -> Result<lkjstr_storage::AccountRecord, JsValue> {
    create_account(&prefix.repeat(64), SignerType::Readonly, timestamp)
        .ok_or_else(|| js_error("account parse failed"))
}

pub async fn wait_for_legacy_clear() -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if legacy_value()?.is_none() {
            return Ok(());
        }
    }
    Err(js_error("legacy selector was not removed"))
}

pub async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!(
        "timed out waiting for {text}: {}",
        document_text()?
    )))
}

pub async fn next_task() -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let callback = Closure::once_into_js(move || {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let timeout = web_sys::window().and_then(|w| {
            w.set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0)
                .ok()
        });
        if timeout.is_none() {
            let _ = reject.call1(&JsValue::NULL, &js_error("missing timeout"));
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

pub fn click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable"))?
        .dyn_into::<web_sys::HtmlElement>()?
        .click();
    Ok(())
}

pub fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

pub fn set_legacy(id: &str) -> Result<(), JsValue> {
    storage()?.set_item(ACTIVE_KEY, id)
}

pub fn clear_legacy() -> Result<(), JsValue> {
    storage()?.remove_item(ACTIVE_KEY)
}

fn legacy_value() -> Result<Option<String>, JsValue> {
    storage()?.get_item(ACTIVE_KEY)
}

fn storage() -> Result<web_sys::Storage, JsValue> {
    web_sys::window()
        .ok_or_else(|| js_error("missing window"))?
        .local_storage()?
        .ok_or_else(|| js_error("missing localStorage"))
}

fn document_text() -> Result<String, JsValue> {
    Ok(document()?
        .body()
        .ok_or_else(|| js_error("missing body"))?
        .text_content()
        .unwrap_or_default())
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing document"))
}

pub fn test_db_name(label: &str) -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-{label}-{}-{random}", js_sys::Date::now() as u64)
}

fn client_for(url: &str) -> Result<StorageWorkerClient, JsValue> {
    match StorageWorkerClient::new_module(url) {
        lkjstr_storage::StorageOutcome::Ok(client) => Ok(client),
        outcome => Err(storage_error("worker open failed", &outcome)),
    }
}

fn assert_ok<T>(outcome: lkjstr_storage::StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        lkjstr_storage::StorageOutcome::Ok(value) => Ok(value),
        other => Err(storage_error("unexpected outcome", &other)),
    }
}

fn storage_error<T>(label: &str, outcome: &lkjstr_storage::StorageOutcome<T>) -> JsValue {
    let reason = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("unknown");
    js_error(&format!("{label}: {reason}"))
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
