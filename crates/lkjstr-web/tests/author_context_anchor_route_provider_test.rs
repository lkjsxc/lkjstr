#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod author_context_relay_provider_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, reset_shells, store_for, test_db_name, wait_for_text,
};
use author_context_relay_provider_support::{
    author_route, install_author_context_websocket, restore_websocket,
};
use lkjstr_domain::{NewTabIds, TabKind, WorkspaceIds, create_workspace, open_configured_tab};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::{sqlite_author_routes_put, sqlite_workspace_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_author_context_finds_uncached_anchor_from_author_route() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("author-context-anchor-route-provider");
    if let Err(error) = seed_author_route_workspace(&db_name).await {
        return skip_unavailable_worker(error);
    }
    install_author_context_websocket(&anchor_event())?;
    let result = open_author_context(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_author_context(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("relay anchor event").await?;
    wait_for_text("Author Context ready.").await
}

async fn seed_author_route_workspace(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_author_routes_put(&store, &[author_route(pubkey())]).await)?;
    assert_ok(sqlite_workspace_put(&store, &workspace()).await)?;
    assert_ok(client.close().await)
}

fn workspace() -> lkjstr_storage::WorkspaceRecord {
    let mut config = BTreeMap::new();
    config.insert("eventId".to_owned(), id(1));
    config.insert("pubkey".to_owned(), pubkey());
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
        TabKind::AuthorContext,
        NewTabIds {
            tab_id: "author-context-tab".to_owned(),
        },
        config,
        2,
    )
}

fn anchor_event() -> NostrEvent {
    NostrEvent {
        id: id(1),
        pubkey: pubkey(),
        created_at: 1_700_000_010,
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
        content: "relay anchor event".to_owned(),
        sig: "f".repeat(128),
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
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
