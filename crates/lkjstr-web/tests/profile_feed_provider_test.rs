#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_METADATA, KIND_TEXT_NOTE, NostrEvent, normalize_relay_url,
};
use lkjstr_storage::{
    AuthorRelayRouteRecord, FeedCoverageRecord, StorageOutcome, StoredEventRecord,
    sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{
    sqlite_account_put, sqlite_author_routes_put, sqlite_event_put, sqlite_feed_coverage_put,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const AUTHOR_RELAY: &str = "wss://author.example";

#[wasm_bindgen_test(async)]
async fn rust_profile_tab_loads_cached_rows_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("profile-provider");
    if let Err(error) = seed_profile_cache(&db_name, false).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_profile_tab().await?;
    wait_for_text("Profile partial").await?;
    wait_for_text("provider profile event").await?;
    wait_for_text("complete Profile coverage proof").await?;
    assert_hidden_non_note_rows()
}

#[wasm_bindgen_test(async)]
async fn rust_profile_tab_uses_exact_complete_coverage() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("profile-provider-complete");
    if let Err(error) = seed_profile_cache(&db_name, true).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_profile_tab().await?;
    wait_for_text("Profile ready").await?;
    wait_for_text("provider profile event").await?;
    wait_for_text("Cached rows").await?;
    assert_hidden_non_note_rows()
}

async fn open_profile_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")
}

async fn seed_profile_cache(db_name: &str, complete: bool) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let account = account("a", 7)?;
    let relay = normalize_relay_url(AUTHOR_RELAY).ok_or_else(|| js_error("bad relay"))?;
    assert_ok(sqlite_account_put(&store, &account).await)?;
    assert_ok(sqlite_author_routes_put(&store, &[route(&account.pubkey)]).await)?;
    put_event(
        &store,
        event(
            "1",
            &account.pubkey,
            KIND_TEXT_NOTE,
            "provider profile event",
        ),
    )
    .await?;
    put_event(
        &store,
        event(
            "2",
            &account.pubkey,
            KIND_METADATA,
            "metadata must not render",
        ),
    )
    .await?;
    put_event(
        &store,
        event(
            "3",
            &account.pubkey,
            KIND_FOLLOW_LIST,
            "follow-list must not render",
        ),
    )
    .await?;
    if complete {
        assert_ok(sqlite_feed_coverage_put(&store, &[coverage(&account.pubkey, &relay)]).await)?;
    }
    assert_ok(client.close().await)
}

async fn put_event(
    store: &lkjstr_web::sqlite_store::SqliteStore,
    event: NostrEvent,
) -> Result<(), JsValue> {
    let relay = sqlite_event_relay_row(&event.id, AUTHOR_RELAY, 10, "cache");
    let row = StoredEventRecord {
        event,
        received_at_ms: 10,
        updated_at_ms: 11,
    };
    assert_ok(sqlite_event_put(store, &row, &[relay]).await)
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

fn coverage(pubkey: &str, relay_url: &str) -> FeedCoverageRecord {
    FeedCoverageRecord {
        coverage_id: "profile-complete".to_owned(),
        feed_key: "profile:rust-new-tab-1".to_owned(),
        route_group_key: format!("author:{pubkey}"),
        relay_url: relay_url.to_owned(),
        filter_fingerprint: profile_filter_key(pubkey),
        status: "complete".to_owned(),
        since_exclusive: Some(0),
        until_exclusive: Some(u64::MAX),
        completed_at_ms: 10,
        event_count: 1,
        dense: false,
    }
}

fn profile_filter_key(pubkey: &str) -> String {
    format!(r#"{{"authors":["{pubkey}"],"kinds":[1,6,16],"tags":[]}}"#)
}

fn event(id_prefix: &str, pubkey: &str, kind: u64, content: &str) -> NostrEvent {
    NostrEvent {
        id: id_prefix.repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind,
        tags: Vec::new(),
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn assert_hidden_non_note_rows() -> Result<(), JsValue> {
    let text = document_text()?;
    if text.contains("metadata must not render") || text.contains("follow-list must not render") {
        return Err(js_error("Profile rendered non-note cache rows"));
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
