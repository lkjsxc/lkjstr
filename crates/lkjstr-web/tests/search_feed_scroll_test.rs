#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod feed_scroll_structure_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use feed_scroll_structure_support::{
    assert_feed_scroll_boundary, assert_tab_body_not_scroll_owner,
};
use lkjstr_domain::{RelayPurpose, RelaySet};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_web::sqlite_store::{sqlite_event_put, sqlite_relay_set_put};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const CACHE_RELAY: &str = "wss://cache.example";

#[wasm_bindgen_test(async)]
async fn rust_search_tab_uses_one_scroll_owner_for_controls_status_and_rows() -> Result<(), JsValue>
{
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("search-scroll-owner");
    if let Err(error) = seed_search_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_search_tab().await?;
    input_value("input[aria-label='Search query']", "nostr wasm")?;
    click(".lkjstr-search-controls button[type='submit']")?;
    wait_for_text("indexed nostr wasm event").await?;
    wait_for_text("Cached rows").await?;
    assert_search_scroll_owner()
}

fn assert_search_scroll_owner() -> Result<(), JsValue> {
    assert_feed_scroll_boundary(
        ".lkjstr-search-feed",
        ".search-list-scroll[data-scroll-owner]",
        &[
            ".lkjstr-search-controls",
            ".lkjstr-feed-status",
            ".lkjstr-feed-rows",
            ".lkjstr-feed-row.event",
            ".lkjstr-feed-footer",
        ],
    )?;
    assert_tab_body_not_scroll_owner(".lkjstr-tab-body[data-tab-kind='search']")
}

async fn open_search_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Relay notes.").await?;
    click("[data-testid='new-tab-option-search']")
}

async fn seed_search_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &empty_user_relay_set()).await)?;
    let event = event("indexed nostr wasm event");
    let relay = sqlite_event_relay_row(&event.id, CACHE_RELAY, 10, "cache");
    let row = StoredEventRecord {
        event,
        received_at_ms: 10,
        updated_at_ms: 11,
    };
    assert_ok(sqlite_event_put(&store, &row, &[relay]).await)?;
    assert_ok(client.close().await)
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

fn event(content: &str) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        pubkey: "a".repeat(64),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn input_value(selector: &str, value: &str) -> Result<(), JsValue> {
    let input = required_element(selector)?.dyn_into::<web_sys::HtmlInputElement>()?;
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

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))
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
