#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::default_user_relay_set;
use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent, NostrTag, normalize_relay_url,
};
use lkjstr_storage::{
    FeedCoverageRecord, StorageOutcome, StoredEventRecord, sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{
    sqlite_account_put, sqlite_event_put, sqlite_feed_coverage_put, sqlite_relay_set_put,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_tab_loads_cached_rows_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("home-provider");
    if let Err(error) = seed_home_cache(&db_name, false).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("Home partial").await?;
    wait_for_text("provider cached event").await?;
    wait_for_text("Cached rows loaded without complete coverage proof").await
}

#[wasm_bindgen_test(async)]
async fn rust_home_tab_uses_exact_complete_coverage() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("home-provider-complete");
    if let Err(error) = seed_home_cache(&db_name, true).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("Home ready").await?;
    wait_for_text("provider cached event").await?;
    wait_for_text("Cached rows").await
}

async fn seed_home_cache(db_name: &str, complete_coverage: bool) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let account = account("a", 7)?;
    let followed_pubkey = pubkey("b");
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
        follow_event(&account.pubkey, &followed_pubkey, &relay_url),
        &relay_url,
    )
    .await?;
    put_event(
        &store,
        event(
            "2",
            &followed_pubkey,
            KIND_TEXT_NOTE,
            Vec::new(),
            "provider cached event",
        ),
        &relay_url,
    )
    .await?;
    if complete_coverage {
        let relay_url = normalize_relay_url(&relay_url).ok_or_else(|| js_error("bad relay"))?;
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

fn follow_event(pubkey: &str, followed_pubkey: &str, relay_url: &str) -> NostrEvent {
    event(
        "1",
        pubkey,
        KIND_FOLLOW_LIST,
        vec![vec![
            "p".to_owned(),
            followed_pubkey.to_owned(),
            relay_url.to_owned(),
            "followed".to_owned(),
        ]],
        "",
    )
}

fn coverage(relay_url: &str) -> FeedCoverageRecord {
    FeedCoverageRecord {
        coverage_id: "home-complete".to_owned(),
        feed_key: "home:rust-timeline-1".to_owned(),
        route_group_key: "selected:fallback".to_owned(),
        relay_url: relay_url.to_owned(),
        filter_fingerprint: home_filter_key(),
        status: "complete".to_owned(),
        since_exclusive: Some(0),
        until_exclusive: Some(u64::MAX),
        completed_at_ms: 10,
        event_count: 1,
        dense: false,
    }
}

fn home_filter_key() -> String {
    format!(
        r#"{{"authors":["{}","{}"],"kinds":[1,6,16],"tags":[]}}"#,
        pubkey("a"),
        pubkey("b")
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
        created_at: ((js_sys::Date::now() / 1000.0) as u64)
            .saturating_sub(id_prefix.parse::<u64>().unwrap_or_default()),
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
