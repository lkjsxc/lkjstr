#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod custom_request_relay_provider_support;
mod feed_scroll_structure_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use custom_request_relay_provider_support::{
    custom_request_event, install_custom_request_websocket,
};
use feed_scroll_structure_support::{
    assert_feed_scroll_boundary, assert_tab_body_not_scroll_owner,
};
use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::sqlite_relay_set_put;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_custom_request_tab_uses_one_scroll_owner_for_controls_status_and_rows()
-> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("custom-request-scroll-owner");
    if let Err(error) = seed_relay_set(&db_name).await {
        return skip_unavailable_worker(error);
    }
    let _websocket = install_custom_request_websocket(&custom_request_event())?;

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_custom_request_tab().await?;
    click(".lkjstr-custom-request-controls button[type='submit']")?;
    wait_for_text("custom request relay event").await?;
    assert_custom_request_scroll_owner()
}

fn assert_custom_request_scroll_owner() -> Result<(), JsValue> {
    assert_feed_scroll_boundary(
        ".lkjstr-custom-request",
        ".custom-request-list-scroll[data-scroll-owner]",
        &[
            ".lkjstr-custom-request-controls",
            ".lkjstr-feed-status",
            ".lkjstr-feed-rows",
            ".lkjstr-feed-row.event",
            ".lkjstr-feed-footer",
        ],
    )?;
    assert_tab_body_not_scroll_owner(".lkjstr-tab-body[data-tab-kind='custom-request']")
}

async fn open_custom_request_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Custom Request").await?;
    click("[data-testid='new-tab-option-custom-request']")?;
    wait_for_text("Enter request JSON.").await
}

async fn seed_relay_set(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(client.close().await)
}

fn relay_set() -> RelaySet {
    RelaySet {
        id: "custom-request-relays".to_owned(),
        name: "Custom Request Relays".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: "wss://selected.example".to_owned(),
            label: "selected".to_owned(),
            enabled: true,
            read: true,
            write: true,
            state: RelayConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            updated_at: 10,
            health: RelayHealth::default(),
        }],
        updated_at: 10,
    }
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
