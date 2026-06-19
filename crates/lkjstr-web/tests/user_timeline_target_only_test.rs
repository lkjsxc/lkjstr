#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod user_timeline_relay_provider_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::default_user_relay_set;
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent, normalize_relay_url};
use lkjstr_storage::{
    FeedCoverageRecord, StorageOutcome, StoredEventRecord, sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{
    sqlite_account_put, sqlite_event_put, sqlite_feed_coverage_put, sqlite_relay_set_put,
};
use user_timeline_relay_provider_support::{
    SELECTED_RELAY, install_empty_follow_list_websocket, restore_websocket,
    user_timeline_request_count,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_uses_target_posts_after_missing_follow_graph() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-target-only");
    if let Err(error) = seed_target_posts_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }
    install_empty_follow_list_websocket()?;
    let result = open_target_posts_only_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_target_posts_only_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")?;
    wait_for_text("Open user timeline").await?;
    click("[aria-label='Open user timeline']")?;
    wait_for_text("Loading public timeline...").await?;
    wait_for_text("Target posts only.").await?;
    wait_for_text("Public follow graph unavailable; showing this user's own public posts.").await?;
    wait_for_text("real target-only timeline event").await?;
    wait_for_text(&format!(
        "Selected relay {SELECTED_RELAY} ended without a public follow-list event."
    ))
    .await?;
    if user_timeline_request_count() == 0 {
        return Err(js_error("expected User Timeline follow-list request"));
    }
    Ok(())
}

async fn seed_target_posts_cache(db_name: &str) -> Result<(), JsValue> {
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
    assert_ok(sqlite_account_put(&store, &account).await)?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set).await)?;
    put_event(
        &store,
        event(&account.pubkey, "real target-only timeline event"),
        &relay_url,
    )
    .await?;
    let relay_url = normalize_relay_url(&relay_url).ok_or_else(|| js_error("bad relay"))?;
    assert_ok(sqlite_feed_coverage_put(&store, &coverage_rows(&relay_url)).await)?;
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

fn coverage_rows(relay_url: &str) -> Vec<FeedCoverageRecord> {
    (1..=4)
        .map(|index| FeedCoverageRecord {
            coverage_id: format!("user-timeline-target-only-{index}"),
            feed_key: format!("user-timeline:rust-user-timeline-{index}"),
            route_group_key: "selected:fallback".to_owned(),
            relay_url: relay_url.to_owned(),
            filter_fingerprint: target_only_filter_key(),
            status: "complete".to_owned(),
            since_exclusive: Some(0),
            until_exclusive: Some(u64::MAX),
            completed_at_ms: 10,
            event_count: 1,
            dense: false,
        })
        .collect()
}

fn target_only_filter_key() -> String {
    format!(
        r#"{{"authors":["{}"],"kinds":[1,6,16],"tags":[]}}"#,
        pubkey("a")
    )
}

fn event(pubkey: &str, content: &str) -> NostrEvent {
    NostrEvent {
        id: "2".repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
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
