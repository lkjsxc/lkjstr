#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod followees_relay_provider_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, next_task, reset_shells, store_for, test_db_name,
    wait_for_text,
};
use followees_relay_provider_support::{
    SELECTED_RELAY, delayed_followees_close_count, delayed_followees_request_count,
    install_delayed_followees_websocket, relay_set, restore_websocket,
    trigger_delayed_followees_event,
};
use lkjstr_domain::{NewTabIds, TabKind, WorkspaceIds, create_workspace, open_configured_tab};
use lkjstr_protocol::{KIND_FOLLOW_LIST, NostrEvent};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::{sqlite_relay_set_put, sqlite_workspace_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_followees_cleanup_closes_relay_read_and_ignores_late_event() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("followees-cleanup");
    let target = pubkey("a");
    let followed = pubkey("b");
    if let Err(error) = seed_followees_route_cache(&db_name, &target).await {
        return skip_unavailable_worker(error);
    }
    install_delayed_followees_websocket(&follow_event(&target, &followed))?;
    let result = open_release_and_trigger_late_followees(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_release_and_trigger_late_followees(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Following").await?;
    wait_for_text("Loading following list...").await?;
    wait_for_request().await?;
    click(".lkjstr-tab-strip button:first-child")?;
    wait_for_close().await?;
    trigger_delayed_followees_event()?;
    for _ in 0..12 {
        next_task().await?;
    }
    if document_text()?.contains("late relay friend") {
        return Err(js_error(
            "late Followees relay event rendered after cleanup",
        ));
    }
    Ok(())
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

async fn wait_for_request() -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if delayed_followees_request_count() > 0 {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for Followees relay request"))
}

async fn wait_for_close() -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if delayed_followees_close_count() > 0 {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for Followees relay close"))
}

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind: KIND_FOLLOW_LIST,
        tags: vec![vec![
            "p".to_owned(),
            followed_pubkey.to_owned(),
            SELECTED_RELAY.to_owned(),
            "late relay friend".to_owned(),
        ]],
        content: String::new(),
        sig: "f".repeat(128),
    }
}

fn document_text() -> Result<String, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.body())
        .and_then(|body| body.text_content())
        .ok_or_else(|| js_error("missing document text"))
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
