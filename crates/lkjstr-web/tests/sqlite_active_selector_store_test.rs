#![cfg(target_arch = "wasm32")]

use lkjstr_domain::{SignerType, create_account};
use lkjstr_storage::ActiveAccountSelectorRecord;
use lkjstr_web::{
    sqlite_store::{
        SqliteStore, sqlite_active_account_selector_delete, sqlite_active_account_selector_get,
        sqlite_active_account_selector_put,
    },
    storage_worker::StorageWorkerClient,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
use web_sys::{Blob, Url};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn active_selector_get_put_delete_round_trip_through_worker() -> Result<(), JsValue> {
    let url = worker_url(active_selector_worker())?;
    let client = match StorageWorkerClient::new_classic(&url) {
        lkjstr_storage::StorageOutcome::Ok(client) => client,
        outcome => return Err(storage_error("worker open failed", &outcome)),
    };
    let store =
        assert_ok(SqliteStore::open(client.clone(), "active.sqlite3".to_owned(), 1_000).await)?;
    let account = create_account(&"4".repeat(64), SignerType::Readonly, 13)
        .ok_or_else(|| js_error("account parse failed"))?;
    let selector = ActiveAccountSelectorRecord::for_account(&account, false, "unknown", 14);

    assert_ok(sqlite_active_account_selector_put(&store, &selector).await)?;
    assert_eq!(
        assert_ok(sqlite_active_account_selector_get(&store).await)?
            .and_then(|row| row.selected_account_id),
        Some(account.id)
    );
    assert_ok(sqlite_active_account_selector_delete(&store).await)?;
    assert!(assert_ok(sqlite_active_account_selector_get(&store).await)?.is_none());
    assert_ok(client.close().await)?;
    Url::revoke_object_url(&url)
}

fn worker_url(script: &str) -> Result<String, JsValue> {
    let parts = js_sys::Array::new();
    parts.push(&JsValue::from_str(script));
    Url::create_object_url_with_blob(&Blob::new_with_str_sequence(&parts)?)
}

fn active_selector_worker() -> &'static str {
    r#"const db={settings:new Map()};
self.onmessage=(event)=>{const r=event.data;try{self.postMessage(run(r));}catch(e){self.postMessage({requestId:r.requestId,outcome:'corrupt',rows:[],rowsAffected:0,diagnostics:{message:String(e)}});}};
function run(r){const op=r.op;if(op.kind==='open'||op.kind==='apply-schema'||op.kind==='close'||op.kind==='cancel')return ok(r,[]);
 if(op.kind==='execute'){write(op.statement,op.params||[]);return ok(r,[]);}
 if(op.kind==='query')return ok(r,query(op.statement,op.params||[]));return ok(r,[]);}
function write(s,p){if(s.includes('INSERT INTO settings'))db.settings.set(p[0],{key:p[0],value_json:p[1],updated_at_ms:p[2]});
 else if(s.includes('DELETE FROM settings'))db.settings.delete(p[0]);}
function query(s,p){if(s.includes('FROM settings WHERE')){const value=db.settings.get(p[0]);return value?[value]:[];}return [];}
function ok(r,rows){return{requestId:r.requestId,outcome:'ok',rows,rowsAffected:1,diagnostics:{}};}"#
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
