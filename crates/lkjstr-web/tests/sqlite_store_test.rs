#![cfg(target_arch = "wasm32")]

use lkjstr_domain::{
    SignerType, TabSnapshotPayload, ToolTabSnapshot, create_account, default_user_relay_set,
    empty_tweet_draft,
};
use lkjstr_storage::{LocalAccountSecretRecord, SettingOverrideRecord, TabStateRecord};
use lkjstr_web::{
    sqlite_store::{
        SqliteStore, sqlite_account_get, sqlite_local_account_put, sqlite_local_secret_get,
        sqlite_relay_set_get, sqlite_relay_set_put, sqlite_setting_delete, sqlite_setting_get,
        sqlite_setting_put, sqlite_tab_state_delete, sqlite_tab_state_get,
        sqlite_tab_state_ledger_get, sqlite_tab_state_put, sqlite_tweet_draft_get,
        sqlite_tweet_draft_put, sqlite_workspace_get, sqlite_workspace_put,
    },
    storage_worker::StorageWorkerClient,
};
use serde_json::json;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
use web_sys::{Blob, Url};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn sqlite_store_protected_repositories_round_trip_through_worker() -> Result<(), JsValue> {
    let (client, url) = client_for(protected_worker())?;
    let store =
        assert_ok(SqliteStore::open(client.clone(), "protected.sqlite3".to_owned(), 1_000).await)?;

    let setting = SettingOverrideRecord {
        key: "tweet.mediaUploadNoTransform".to_owned(),
        namespace: "tweet".to_owned(),
        value: json!(false),
        updated_at: 42,
    };
    assert_ok(sqlite_setting_put(&store, &setting).await)?;
    let stored_setting = assert_some(sqlite_setting_get(&store, &setting.key).await)?;
    assert_eq!(stored_setting.value, json!(false));
    assert_ok(sqlite_setting_delete(&store, &setting.key).await)?;
    assert!(assert_ok(sqlite_setting_get(&store, &setting.key).await)?.is_none());

    let workspace = lkjstr_domain::bootstrap_workspace();
    assert_ok(sqlite_workspace_put(&store, &workspace).await)?;
    assert_eq!(
        assert_some(sqlite_workspace_get(&store, "main").await)?.id,
        "main"
    );

    let account = sample_account()?;
    let secret = sample_secret(&account);
    assert_ok(sqlite_local_account_put(&store, &account, &secret).await)?;
    assert_eq!(
        assert_some(sqlite_account_get(&store, &account.id).await)?.id,
        account.id
    );
    assert_eq!(
        assert_some(sqlite_local_secret_get(&store, &account.id).await)?.secret_key,
        secret.secret_key
    );

    let relay_set = default_user_relay_set(9);
    assert_ok(sqlite_relay_set_put(&store, &relay_set).await)?;
    assert_eq!(
        assert_some(sqlite_relay_set_get(&store, &relay_set.id).await)?.id,
        relay_set.id
    );

    let draft = empty_tweet_draft("tab:tweet", 11);
    assert_ok(sqlite_tweet_draft_put(&store, &draft).await)?;
    assert_eq!(
        assert_some(sqlite_tweet_draft_get(&store, &draft.id).await)?.id,
        draft.id
    );

    let tab = sample_tab_state();
    assert_ok(sqlite_tab_state_put(&store, &tab).await)?;
    assert_eq!(
        assert_some(sqlite_tab_state_get(&store, &tab.id).await)?.id,
        tab.id
    );
    assert_eq!(
        assert_some(sqlite_tab_state_ledger_get(&store, &tab.id).await)?.resource_kind,
        "tab-state"
    );
    assert_ok(sqlite_tab_state_delete(&store, &tab.id).await)?;
    assert!(assert_ok(sqlite_tab_state_get(&store, &tab.id).await)?.is_none());

    assert_ok(client.close().await)?;
    Url::revoke_object_url(&url)
}

fn sample_account() -> Result<lkjstr_storage::AccountRecord, JsValue> {
    create_account(&"1".repeat(64), SignerType::Readonly, 7)
        .ok_or_else(|| js_error("account parse failed"))
}

fn sample_secret(account: &lkjstr_storage::AccountRecord) -> LocalAccountSecretRecord {
    LocalAccountSecretRecord {
        account_id: account.id.clone(),
        pubkey: account.pubkey.clone(),
        secret_key: "2".repeat(64),
        created_at: 7,
        updated_at: 8,
    }
}

fn sample_tab_state() -> TabStateRecord {
    TabStateRecord {
        id: "main:tab".to_owned(),
        workspace_id: "main".to_owned(),
        tab_id: "tab".to_owned(),
        last_pane_id: Some("pane".to_owned()),
        state: TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(12),
            ..ToolTabSnapshot::default()
        }),
        updated_at: 3_600_000,
    }
}

fn assert_ok<T>(outcome: lkjstr_storage::StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        lkjstr_storage::StorageOutcome::Ok(value) => Ok(value),
        other => Err(storage_error("unexpected outcome", &other)),
    }
}

fn assert_some<T>(outcome: lkjstr_storage::StorageOutcome<Option<T>>) -> Result<T, JsValue> {
    assert_ok(outcome)?.ok_or_else(|| js_error("missing row"))
}

fn client_for(script: &str) -> Result<(StorageWorkerClient, String), JsValue> {
    let url = worker_url(script)?;
    match StorageWorkerClient::new_classic(&url) {
        lkjstr_storage::StorageOutcome::Ok(client) => Ok((client, url)),
        outcome => Err(storage_error("worker open failed", &outcome)),
    }
}

fn storage_error<T>(label: &str, outcome: &lkjstr_storage::StorageOutcome<T>) -> JsValue {
    let reason = outcome
        .problem()
        .map(|problem| problem.reason)
        .unwrap_or("unknown");
    js_error(&format!("{label}: {reason}"))
}

fn worker_url(script: &str) -> Result<String, JsValue> {
    let parts = js_sys::Array::new();
    parts.push(&JsValue::from_str(script));
    Url::create_object_url_with_blob(&Blob::new_with_str_sequence(&parts)?)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}

fn protected_worker() -> &'static str {
    r#"const db={settings:new Map(),workspaces:new Map(),accounts:new Map(),secrets:new Map(),relays:new Map(),drafts:new Map(),tabs:new Map(),ledger:new Map()};
self.onmessage=(event)=>{const r=event.data;try{self.postMessage(run(r));}catch(e){self.postMessage({requestId:r.requestId,outcome:'corrupt',rows:[],rowsAffected:0,diagnostics:{message:String(e)}});}};
function run(r){const op=r.op;if(op.kind==='open'||op.kind==='apply-schema'||op.kind==='close'||op.kind==='cancel')return ok(r,[]);
 if(op.kind==='execute'){write(op.statement,op.params||[]);return ok(r,[]);}
 if(op.kind==='batch'){for(const step of op.steps)write(step.statement,step.params||[]);return ok(r,[]);}
 if(op.kind==='query')return ok(r,query(op.statement,op.params||[]));
 return ok(r,[]);}
function ok(r,rows){return{requestId:r.requestId,outcome:'ok',rows,rowsAffected:1,diagnostics:{}};}
function write(s,p){if(s.includes('INSERT INTO settings'))db.settings.set(p[0],{key:p[0],value_json:p[1],updated_at_ms:p[2]});
 else if(s.includes('DELETE FROM settings'))db.settings.delete(p[0]);
 else if(s.includes('INSERT INTO workspaces'))db.workspaces.set(p[0],{workspace_id:p[0],layout_json:p[1],active_pane_id:p[2],active_tab_id:p[3],created_at_ms:p[4],updated_at_ms:p[5]});
 else if(s.includes('INSERT INTO accounts'))db.accounts.set(p[0],{pubkey:p[0],label:p[1],signer_kind:p[2],created_at_ms:p[3],updated_at_ms:p[4],metadata_json:p[5]});
 else if(s.includes('DELETE FROM accounts')){db.accounts.delete(p[0]);db.secrets.delete(p[0]);}
 else if(s.includes('INSERT INTO local_account_secrets'))db.secrets.set(p[0],{pubkey:p[0],secret_payload:p[1],created_at_ms:p[2],updated_at_ms:p[3]});
 else if(s.includes('INSERT INTO relay_sets'))db.relays.set(p[0],{set_id:p[0],name:p[1],relays_json:p[2],selected_read:p[3],selected_write:p[4],updated_at_ms:p[5]});
 else if(s.includes('INSERT INTO tweet_drafts'))db.drafts.set(p[0],{draft_id:p[0],owner_pubkey:p[1],body:p[2],attachments_json:p[3],tags_json:p[4],updated_at_ms:p[5]});
 else if(s.includes('INSERT INTO tab_states'))db.tabs.set(p[0]+':'+p[1],{workspace_id:p[0],tab_id:p[1],tab_kind:p[2],snapshot_json:p[3],scroll_anchor_json:p[4],updated_at_ms:p[5],stale_after_ms:p[6]});
 else if(s.includes('DELETE FROM tab_states'))db.tabs.delete(p[0]+':'+p[1]);
 else if(s.includes('INSERT INTO cache_ledger'))db.ledger.set(p[0],{resource_id:p[0],resource_kind:p[1],table_name:p[2],byte_count:p[3],protected:p[4],score:p[5],owner_key:p[6],created_at_ms:p[7],updated_at_ms:p[8]});
 else if(s.includes('DELETE FROM cache_ledger'))db.ledger.delete(p[0]);}
function query(s,p){if(s.includes('FROM settings WHERE'))return one(db.settings,p[0]);
 if(s.includes('FROM workspaces'))return one(db.workspaces,p[0]);
 if(s.includes('FROM accounts'))return one(db.accounts,p[0]);
 if(s.includes('FROM local_account_secrets'))return one(db.secrets,p[0]);
 if(s.includes('FROM relay_sets'))return one(db.relays,p[0]);
 if(s.includes('FROM tweet_drafts'))return one(db.drafts,p[0]);
 if(s.includes('FROM tab_states WHERE workspace_id = ?1 AND tab_id'))return one(db.tabs,p[0]+':'+p[1]);
 if(s.includes('FROM cache_ledger'))return one(db.ledger,p[0]);
 return [];}
function one(map,key){const value=map.get(key);return value?[value]:[];}"#
}
