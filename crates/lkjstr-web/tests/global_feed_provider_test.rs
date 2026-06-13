#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent, normalize_relay_url};
use lkjstr_storage::{
    FeedCoverageRecord, StorageOutcome, StoredEventRecord, sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{sqlite_event_put, sqlite_feed_coverage_put, sqlite_relay_set_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const SELECTED_RELAY: &str = "wss://selected.example";

#[wasm_bindgen_test(async)]
async fn rust_global_tab_loads_cached_rows_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("global-provider");
    if let Err(error) = seed_global_cache(&db_name, false).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_global_tab().await?;
    wait_for_text("Global partial").await?;
    wait_for_text("provider global event").await?;
    wait_for_text("complete Global coverage proof").await
}

#[wasm_bindgen_test(async)]
async fn rust_global_tab_uses_exact_complete_coverage() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("global-provider-complete");
    if let Err(error) = seed_global_cache(&db_name, true).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_global_tab().await?;
    wait_for_text("Global ready").await?;
    wait_for_text("provider global event").await?;
    wait_for_text("Older rows available").await
}

async fn open_global_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-global']")
}

async fn seed_global_cache(db_name: &str, complete_coverage: bool) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let relay_url = normalize_relay_url(SELECTED_RELAY).ok_or_else(|| js_error("bad relay"))?;

    assert_ok(sqlite_relay_set_put(&store, &relay_set(SELECTED_RELAY)).await)?;
    put_event(&store, event("2", "provider global event"), SELECTED_RELAY).await?;
    if complete_coverage {
        assert_ok(sqlite_feed_coverage_put(&store, &[coverage(&relay_url)]).await)?;
    }
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

fn relay_set(url: &str) -> RelaySet {
    RelaySet {
        id: "global-test-relays".to_owned(),
        name: "Global Test Relays".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: url.to_owned(),
            label: "Selected".to_owned(),
            enabled: true,
            read: true,
            write: false,
            state: RelayConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            updated_at: 9,
            health: RelayHealth::default(),
        }],
        updated_at: 9,
    }
}

fn coverage(relay_url: &str) -> FeedCoverageRecord {
    FeedCoverageRecord {
        coverage_id: "global-complete".to_owned(),
        feed_key: "global:rust-new-tab-1".to_owned(),
        route_group_key: "selected:fallback".to_owned(),
        relay_url: relay_url.to_owned(),
        filter_fingerprint: r#"{"kinds":[1],"tags":[]}"#.to_owned(),
        status: "complete".to_owned(),
        since_exclusive: Some(0),
        until_exclusive: Some(u64::MAX),
        completed_at_ms: 10,
        event_count: 1,
        dense: false,
    }
}

fn event(id_prefix: &str, content: &str) -> NostrEvent {
    NostrEvent {
        id: id_prefix.repeat(64),
        pubkey: "a".repeat(64),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
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
