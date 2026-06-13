#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_web::sqlite_store::{sqlite_account_put, sqlite_event_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_followees_tab_loads_cached_kind3_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("followees-provider");
    if let Err(error) = seed_followees_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")?;
    wait_for_text("1 following").await?;
    click("[aria-label='Open following list']")?;
    wait_for_text("Public follow list found.").await?;
    wait_for_text("best friend").await
}

async fn seed_followees_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let account = account("a", 7)?;
    assert_ok(sqlite_account_put(&store, &account).await)?;
    let event = follow_event(&account.pubkey, &pubkey("b"));
    let relay = sqlite_event_relay_row(&event.id, "wss://relay.example", 10, "cache");
    let row = StoredEventRecord {
        event,
        received_at_ms: 10,
        updated_at_ms: 11,
    };
    assert_ok(sqlite_event_put(&store, &row, &[relay]).await)?;
    assert_ok(client.close().await)
}

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind: KIND_FOLLOW_LIST,
        tags: vec![vec![
            "p".to_owned(),
            followed_pubkey.to_owned(),
            "wss://relay.example".to_owned(),
            "best friend".to_owned(),
        ]],
        content: String::new(),
        sig: "f".repeat(128),
    }
}

fn pubkey(prefix: &str) -> String {
    prefix.repeat(64)
}

fn assert_ok<T>(outcome: StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        StorageOutcome::Ok(value) => Ok(value),
        other => {
            let reason = other.problem().map_or("unknown", |problem| problem.reason);
            Err(js_error(&format!("unexpected storage outcome: {reason}")))
        }
    }
}

fn skip_unavailable_worker(error: JsValue) -> Result<(), JsValue> {
    if format!("{error:?}").contains("unavailable") {
        return Ok(());
    }
    Err(error)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
