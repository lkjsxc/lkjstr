#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_protocol::normalize_relay_url;
use lkjstr_storage::{AuthorRelayRouteRecord, FeedCoverageRecord, StorageOutcome};
use lkjstr_web::sqlite_store::{
    sqlite_account_put, sqlite_author_routes_put, sqlite_feed_coverage_put,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const AUTHOR_RELAY: &str = "wss://author.example";

#[wasm_bindgen_test(async)]
async fn recent_empty_profile_coverage_searches_older_history() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("profile-sparse-recent-empty");
    if let Err(error) = seed_empty_profile(&db_name, false).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_profile_tab().await?;
    wait_for_text("Profile partial").await?;
    wait_for_text("Scanning older Profile history").await?;
    assert_missing_text("No rows")
}

#[wasm_bindgen_test(async)]
async fn full_empty_profile_coverage_renders_terminal_empty() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("profile-sparse-empty-proven");
    if let Err(error) = seed_empty_profile(&db_name, true).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_profile_tab().await?;
    wait_for_text("Profile ready").await?;
    wait_for_text("No rows").await
}

async fn open_profile_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")
}

async fn seed_empty_profile(db_name: &str, full_history: bool) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let account = account("a", 7)?;
    assert_ok(sqlite_account_put(&store, &account).await)?;
    assert_ok(sqlite_author_routes_put(&store, &[route(&account.pubkey)]).await)?;
    let now_sec = (js_sys::Date::now() / 1000.0) as u64;
    let coverage = if full_history {
        coverage(&account.pubkey, 0, u64::MAX)
    } else {
        coverage(
            &account.pubkey,
            now_sec.saturating_sub(60),
            now_sec.saturating_add(60),
        )
    };
    assert_ok(sqlite_feed_coverage_put(&store, &[coverage]).await)?;
    assert_ok(client.close().await)
}

fn route(pubkey: &str) -> AuthorRelayRouteRecord {
    AuthorRelayRouteRecord {
        pubkey: pubkey.to_owned(),
        relay_url: AUTHOR_RELAY.to_owned(),
        route_kind: "nip65".to_owned(),
        evidence_json: "{}".to_owned(),
        updated_at_ms: 10,
        expires_at_ms: None,
    }
}

fn coverage(pubkey: &str, since: u64, until: u64) -> FeedCoverageRecord {
    FeedCoverageRecord {
        coverage_id: format!("profile-empty-{since}-{until}"),
        feed_key: "profile:rust-new-tab-1".to_owned(),
        route_group_key: format!("author:{pubkey}"),
        relay_url: normalize_relay_url(AUTHOR_RELAY).unwrap_or_else(|| AUTHOR_RELAY.to_owned()),
        filter_fingerprint: profile_filter_key(pubkey),
        status: "complete".to_owned(),
        since_exclusive: Some(since),
        until_exclusive: Some(until),
        completed_at_ms: 10,
        event_count: 0,
        dense: false,
    }
}

fn profile_filter_key(pubkey: &str) -> String {
    format!(r#"{{"authors":["{pubkey}"],"kinds":[1,6,16],"tags":[]}}"#)
}

fn assert_missing_text(text: &str) -> Result<(), JsValue> {
    if document_text()?.contains(text) {
        return Err(js_error(&format!("unexpected text: {text}")));
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.body())
        .map(|body| body.text_content().unwrap_or_default())
        .ok_or_else(|| js_error("missing document text"))
}

fn assert_ok<T>(outcome: StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        StorageOutcome::Ok(value) => Ok(value),
        other => Err(js_error(&format!(
            "unexpected storage outcome: {}",
            other.problem().map_or("unknown", |problem| problem.reason)
        ))),
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
