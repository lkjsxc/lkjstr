#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use std::collections::BTreeMap;

use lkjstr_app::{StartupInput, default_recovery_ids};
use lkjstr_domain::{
    FeedTabSnapshot, NewTabIds, TabKind, TabSnapshotPayload, bootstrap_workspace, open_tab,
};
use lkjstr_storage::{StorageOutcome, TabStateRecord, tab_state_id};
use lkjstr_web::sqlite_store::sqlite_tab_states_for_workspace;
use wasm_bindgen::{JsCast, prelude::JsValue};

use crate::accounts_selector_test_support::{next_task, store_for};

pub async fn wait_for_saved_search_query(db_name: &str, query: &str) -> Result<(), JsValue> {
    for _ in 0..120 {
        next_task().await?;
        if saved_search_query(db_name, query).await? {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for saved search query"))
}

pub fn search_startup(query: &str) -> StartupInput {
    let tab_id = "search-restore-tab";
    StartupInput {
        stored_workspace: Some(open_tab(
            bootstrap_workspace(),
            Some("bootstrap-welcome-pane"),
            TabKind::Search,
            NewTabIds {
                tab_id: tab_id.to_owned(),
            },
            11,
        )),
        storage_available: true,
        tab_snapshots: vec![TabStateRecord {
            id: tab_state_id("main", tab_id),
            workspace_id: "main".to_owned(),
            tab_id: tab_id.to_owned(),
            last_pane_id: Some("bootstrap-welcome-pane".to_owned()),
            state: TabSnapshotPayload::Feed(FeedTabSnapshot {
                filter_state: BTreeMap::from([("searchQuery".to_owned(), query.to_owned())]),
                ..FeedTabSnapshot::default()
            }),
            updated_at: 12,
        }],
        recovery_ids: default_recovery_ids("main"),
        now: 13,
    }
}

pub fn search_input() -> Result<web_sys::HtmlInputElement, JsValue> {
    Ok(document()?
        .query_selector("input[aria-label='Search query']")?
        .ok_or_else(|| js_error("missing search input"))?
        .dyn_into::<web_sys::HtmlInputElement>()?)
}

async fn saved_search_query(db_name: &str, query: &str) -> Result<bool, JsValue> {
    let (client, store) = store_for(db_name).await?;
    let rows = assert_ok(sqlite_tab_states_for_workspace(&store, "main").await)?;
    assert_ok(client.close().await)?;
    Ok(rows.iter().any(|row| row_has_search_query(row, query)))
}

fn row_has_search_query(row: &TabStateRecord, query: &str) -> bool {
    let TabSnapshotPayload::Feed(feed) = &row.state else {
        return false;
    };
    feed.filter_state
        .get("searchQuery")
        .is_some_and(|value| value == query)
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

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
