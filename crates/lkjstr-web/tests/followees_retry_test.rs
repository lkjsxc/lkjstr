#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod followees_relay_provider_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, next_task, reset_shells, store_for, test_db_name,
    wait_for_text,
};
use followees_relay_provider_support::{
    SELECTED_RELAY, delayed_followees_request_count, install_empty_followees_websocket, relay_set,
    restore_websocket,
};
use lkjstr_domain::{NewTabIds, TabKind, WorkspaceIds, create_workspace, open_configured_tab};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::{sqlite_relay_set_put, sqlite_workspace_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_followees_empty_selected_relay_renders_retry_diagnostic() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("followees-retry");
    if let Err(error) = seed_followees_route_cache(&db_name, &pubkey("a")).await {
        return skip_unavailable_worker(error);
    }
    install_empty_followees_websocket()?;
    let result = open_retryable_followees(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_retryable_followees(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Following").await?;
    wait_for_text("Loading following list...").await?;
    wait_for_text("Follow-list discovery incomplete after 1 selected relay read. Retry available.")
        .await?;
    wait_for_text("Selected relay did not return a follow list before the read ended.").await?;
    wait_for_text(SELECTED_RELAY).await?;
    click("[data-testid='followees-retry']")?;
    wait_for_retry_request().await
}

async fn seed_followees_route_cache(db_name: &str, target: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(sqlite_workspace_put(&store, &workspace(target)).await)?;
    assert_ok(client.close().await)
}

fn workspace(target: &str) -> lkjstr_storage::WorkspaceRecord {
    let mut config = BTreeMap::new();
    config.insert("pubkey".to_owned(), target.to_owned());
    open_configured_tab(
        create_workspace(
            WorkspaceIds {
                workspace_id: "main".to_owned(),
                pane_id: "pane".to_owned(),
                group_id: "group".to_owned(),
                tab_id: "welcome".to_owned(),
            },
            1,
        ),
        Some("pane"),
        TabKind::Followees,
        NewTabIds {
            tab_id: "followees-tab".to_owned(),
        },
        config,
        2,
    )
}

async fn wait_for_retry_request() -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if delayed_followees_request_count() >= 2 {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for Followees retry request"))
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
