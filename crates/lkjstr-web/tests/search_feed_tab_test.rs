#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
#[path = "support/search_feed_tab.rs"]
mod search_feed_tab_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::{RelayPurpose, RelaySet};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_web::sqlite_store::{sqlite_event_put, sqlite_relay_set_put};
use search_feed_tab_support::{search_input, search_startup, wait_for_saved_search_query};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const CACHE_RELAY: &str = "wss://cache.example";
#[wasm_bindgen_test(async)]
async fn rust_search_tab_loads_local_indexed_rows_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("search-provider");
    if let Err(error) = seed_search_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(
        db_name.clone(),
        WORKER_URL.to_owned(),
    );
    open_search_tab().await?;
    wait_for_text("Enter a search query").await?;
    assert!(!document_text()?.contains("Rust Search provider execution is not wired yet."));

    input_value("input[aria-label='Search query']", "nostr wasm")?;
    click(".lkjstr-search-controls button[type='submit']")?;
    wait_for_text("Search ready").await?;
    wait_for_text("indexed nostr wasm event").await?;
    wait_for_text("Cached rows").await?;
    wait_for_saved_search_query(&db_name, "nostr wasm").await
}

#[wasm_bindgen_test(async)]
async fn rust_search_tab_restores_query_from_feed_snapshot() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;

    lkjstr_ui::mount_app_with_startup(search_startup("restored nostr"));

    wait_for_text("Enter a search query").await?;
    assert_eq!(search_input()?.value(), "restored nostr");
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_search_tab_loads_older_cache_page_with_compound_cursor() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("search-older");
    if let Err(error) = seed_search_page_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_search_tab().await?;
    input_value("input[aria-label='Search query']", "same-second indexed")?;
    click(".lkjstr-search-controls button[type='submit']")?;
    wait_for_text("Older rows available").await?;
    assert!(!document_text()?.contains("same-second indexed nostr wasm 30"));
    click("[data-testid='search-load-older']")?;
    wait_for_text("same-second indexed nostr wasm 30").await
}

async fn open_search_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-search']")
}

async fn seed_search_page_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &empty_user_relay_set()).await)?;
    let created_at = ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2);
    for index in 0..31 {
        let id = format!("{index:064x}");
        let content = format!("same-second indexed nostr wasm {index:02}");
        put_event(&store, event_at(&id, &content, created_at), CACHE_RELAY).await?;
    }
    assert_ok(client.close().await)
}

async fn seed_search_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &empty_user_relay_set()).await)?;
    put_event(&store, event("1", "indexed nostr wasm event"), CACHE_RELAY).await?;
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

fn empty_user_relay_set() -> RelaySet {
    RelaySet {
        id: "search-test-relays".to_owned(),
        name: "Search Test Relays".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: Vec::new(),
        updated_at: 9,
    }
}

fn event(id_prefix: &str, content: &str) -> NostrEvent {
    event_at(
        &id_prefix.repeat(64),
        content,
        ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
    )
}

fn event_at(id: &str, content: &str, created_at: u64) -> NostrEvent {
    NostrEvent {
        id: id.to_owned(),
        pubkey: "a".repeat(64),
        created_at,
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn input_value(selector: &str, value: &str) -> Result<(), JsValue> {
    let input = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing search input"))?
        .dyn_into::<web_sys::HtmlInputElement>()?;
    input.set_value(value);
    input.dispatch_event(&bubbling_event("input")?)?;
    input.dispatch_event(&bubbling_event("change")?)?;
    Ok(())
}

fn bubbling_event(name: &str) -> Result<web_sys::Event, JsValue> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    web_sys::Event::new_with_event_init_dict(name, &init)
}

fn document_text() -> Result<String, JsValue> {
    document()?
        .body()
        .and_then(|body| body.text_content())
        .ok_or_else(|| js_error("missing document text"))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
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
