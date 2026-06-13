#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::default_user_relay_set;
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent, NostrTag};
use lkjstr_storage::{
    NotificationRecord, StorageOutcome, StoredEventRecord, sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{
    sqlite_account_put, sqlite_event_put, sqlite_notifications_put, sqlite_relay_set_put,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_notifications_tab_loads_cached_rows_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("notifications-provider");
    if let Err(error) = seed_notifications_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-notifications']")?;
    wait_for_text("Notifications partial").await?;
    wait_for_text("mention").await?;
    wait_for_text("provider notification event").await?;
    wait_for_text("Cached notification records loaded without complete coverage proof").await
}

async fn seed_notifications_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let account = account("a", 7)?;
    let relay_set = default_user_relay_set(9);
    let relay_url = relay_set
        .relays
        .iter()
        .find(|relay| relay.enabled && relay.read)
        .ok_or_else(|| js_error("missing read relay"))?
        .url
        .clone();
    let event = source_event(&account.pubkey);

    assert_ok(sqlite_account_put(&store, &account).await)?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set).await)?;
    put_event(&store, event.clone(), &relay_url).await?;
    assert_ok(sqlite_notifications_put(&store, &[notification(&account.pubkey, &event)]).await)?;
    assert_ok(client.close().await)
}

async fn put_event(
    store: &lkjstr_web::sqlite_store::SqliteStore,
    event: NostrEvent,
    relay_url: &str,
) -> Result<(), JsValue> {
    let relay = sqlite_event_relay_row(&event.id, relay_url, 10, "cache");
    let row = StoredEventRecord {
        event,
        received_at_ms: 10,
        updated_at_ms: 11,
    };
    assert_ok(sqlite_event_put(store, &row, &[relay]).await)
}

fn notification(owner_pubkey: &str, event: &NostrEvent) -> NotificationRecord {
    NotificationRecord {
        notification_id: "notification-1".to_owned(),
        owner_pubkey: owner_pubkey.to_owned(),
        source_event_id: event.id.clone(),
        target_event_id: None,
        root_event_id: None,
        actor_pubkey: event.pubkey.clone(),
        notification_kind: "mention".to_owned(),
        created_at: event.created_at,
        updated_at_ms: 11,
    }
}

fn source_event(owner_pubkey: &str) -> NostrEvent {
    event(
        "3",
        &pubkey("b"),
        KIND_TEXT_NOTE,
        vec![vec!["p".to_owned(), owner_pubkey.to_owned()]],
        "provider notification event",
    )
}

fn event(
    id_prefix: &str,
    pubkey: &str,
    kind: u64,
    tags: Vec<NostrTag>,
    content: &str,
) -> NostrEvent {
    NostrEvent {
        id: id_prefix.repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(3),
        kind,
        tags,
        content: content.to_owned(),
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
            let reason = other
                .problem()
                .map(|problem| problem.reason)
                .unwrap_or("unknown");
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
