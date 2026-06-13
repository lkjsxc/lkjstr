#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod user_timeline_cleanup_support;
mod user_timeline_relay_provider_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, next_task, reset_shells, store_for, test_db_name,
    wait_for_text,
};
use lkjstr_domain::{NewTabIds, TabKind, WorkspaceIds, create_workspace, open_configured_tab};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent, NostrTag};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_web::sqlite_store::{sqlite_event_put, sqlite_relay_set_put, sqlite_workspace_put};
use user_timeline_cleanup_support::{
    delayed_user_timeline_close_count, delayed_user_timeline_request_count,
    install_delayed_user_timeline_websocket, restore_delayed_user_timeline_websocket,
    trigger_delayed_user_timeline_event,
};
use user_timeline_relay_provider_support::{SELECTED_RELAY, relay_set};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const LATE_EVENT_CONTENT: &str = "late user timeline event";

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_cleanup_closes_relay_read_and_ignores_late_event() -> Result<(), JsValue>
{
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-cleanup");
    let target = pubkey("a");
    let followed = pubkey("b");
    if let Err(error) = seed_user_timeline_route_cache(&db_name, &target, &followed).await {
        return skip_unavailable_worker(error);
    }
    install_delayed_user_timeline_websocket(&follow_event(&target, &followed))?;
    let result = open_release_and_trigger_late_user_timeline(db_name).await;
    let restore = restore_delayed_user_timeline_websocket();
    result.and(restore)
}

async fn open_release_and_trigger_late_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("User Timeline").await?;
    wait_for_text("Loading public timeline...").await?;
    wait_for_request().await?;
    click(".lkjstr-tab-strip button:first-child")?;
    wait_for_close().await?;
    trigger_delayed_user_timeline_event()?;
    for _ in 0..12 {
        next_task().await?;
    }
    if document_text()?.contains(LATE_EVENT_CONTENT) {
        return Err(js_error(
            "late User Timeline relay event rendered after cleanup",
        ));
    }
    Ok(())
}

async fn seed_user_timeline_route_cache(
    db_name: &str,
    target: &str,
    followed: &str,
) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(sqlite_workspace_put(&store, &workspace(target)).await)?;
    put_event(&store, note_event(followed)).await?;
    assert_ok(client.close().await)
}

async fn put_event(
    store: &lkjstr_web::sqlite_store::SqliteStore,
    event: NostrEvent,
) -> Result<(), JsValue> {
    let relay = sqlite_event_relay_row(&event.id, SELECTED_RELAY, 10, "cache");
    let row = StoredEventRecord {
        event,
        received_at_ms: 10,
        updated_at_ms: 11,
    };
    assert_ok(sqlite_event_put(store, &row, &[relay]).await)
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
        TabKind::UserTimeline,
        NewTabIds {
            tab_id: "user-timeline-tab".to_owned(),
        },
        config,
        2,
    )
}

async fn wait_for_request() -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if delayed_user_timeline_request_count() > 0 {
            return Ok(());
        }
    }
    Err(js_error(
        "timed out waiting for User Timeline relay request",
    ))
}

async fn wait_for_close() -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if delayed_user_timeline_close_count() > 0 {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for User Timeline relay close"))
}

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    event(
        "1",
        pubkey,
        KIND_FOLLOW_LIST,
        vec![vec!["p".to_owned(), followed_pubkey.to_owned()]],
        "",
    )
}

fn note_event(pubkey: &str) -> NostrEvent {
    event("2", pubkey, KIND_TEXT_NOTE, Vec::new(), LATE_EVENT_CONTENT)
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
