#![cfg(target_arch = "wasm32")]

use lkjstr_storage::{SettingOverrideRecord, StorageOutcome};
use lkjstr_web::{
    sqlite_store::{
        SqliteStore, sqlite_setting_get, sqlite_setting_put, sqlite_settings_all,
        sqlite_settings_replace_all,
    },
    storage_worker::StorageWorkerClient,
};
use serde_json::json;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
use web_sys::{Blob, Url};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn sqlite_settings_replace_all_is_transactional_command() -> Result<(), JsValue> {
    let (client, url) = client_for(worker())?;
    let store =
        assert_ok(SqliteStore::open(client.clone(), "settings.sqlite3".to_owned(), 1_000).await)?;

    assert_ok(sqlite_setting_put(&store, &row("appearance.cornerRadius", json!(6), 1)).await)?;
    assert_ok(sqlite_setting_put(&store, &row("cache.maxBytes", json!(1048576), 2)).await)?;
    assert_eq!(assert_ok(sqlite_settings_all(&store).await)?.len(), 2);

    let next = vec![row("publish.clientTag.enabled", json!(true), 3)];
    assert_ok(sqlite_settings_replace_all(&store, &next).await)?;

    assert!(assert_ok(sqlite_setting_get(&store, "appearance.cornerRadius").await)?.is_none());
    assert_eq!(
        assert_ok(sqlite_setting_get(&store, "publish.clientTag.enabled").await)?
            .map(|item| item.value),
        Some(json!(true))
    );

    assert_ok(client.close().await)?;
    Url::revoke_object_url(&url)
}

fn row(key: &str, value: serde_json::Value, updated_at: u64) -> SettingOverrideRecord {
    SettingOverrideRecord {
        key: key.to_owned(),
        namespace: key
            .split_once('.')
            .map_or("debug", |part| part.0)
            .to_owned(),
        value,
        updated_at,
    }
}

fn assert_ok<T>(outcome: StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        StorageOutcome::Ok(value) => Ok(value),
        other => Err(storage_error("unexpected outcome", &other)),
    }
}

fn client_for(script: &str) -> Result<(StorageWorkerClient, String), JsValue> {
    let url = worker_url(script)?;
    match StorageWorkerClient::new_classic(&url) {
        StorageOutcome::Ok(client) => Ok((client, url)),
        outcome => Err(storage_error("worker open failed", &outcome)),
    }
}

fn storage_error<T>(label: &str, outcome: &StorageOutcome<T>) -> JsValue {
    let reason = outcome
        .problem()
        .map_or("unknown", |problem| problem.reason);
    js_sys::Error::new(&format!("{label}: {reason}")).into()
}

fn worker_url(script: &str) -> Result<String, JsValue> {
    let parts = js_sys::Array::new();
    parts.push(&JsValue::from_str(script));
    Url::create_object_url_with_blob(&Blob::new_with_str_sequence(&parts)?)
}

fn worker() -> &'static str {
    r#"const settings=new Map();
self.onmessage=(event)=>{const r=event.data;self.postMessage(run(r));};
function run(r){const op=r.op;if(op.kind==='open'||op.kind==='apply-schema'||op.kind==='close')return ok(r,[]);
 if(op.kind==='execute'){write(op.statement,op.params||[]);return ok(r,[]);}
 if(op.kind==='batch'){for(const step of op.steps)write(step.statement,step.params||[]);return ok(r,[]);}
 if(op.kind==='query')return ok(r,query(op.statement,op.params||[]));return ok(r,[]);}
function ok(r,rows){return{requestId:r.requestId,outcome:'ok',rows,rowsAffected:1,diagnostics:{}};}
function write(s,p){if(s.includes('INSERT INTO settings'))settings.set(p[0],{key:p[0],value_json:p[1],updated_at_ms:p[2]});
 else if(s.includes('DELETE FROM settings WHERE'))settings.delete(p[0]);
 else if(s.includes('DELETE FROM settings'))settings.clear();}
function query(s,p){if(s.includes('FROM settings WHERE'))return one(settings,p[0]);
 if(s.includes('FROM settings'))return Array.from(settings.values()).sort((a,b)=>a.key.localeCompare(b.key));return [];}
function one(map,key){const value=map.get(key);return value?[value]:[];}"#
}
