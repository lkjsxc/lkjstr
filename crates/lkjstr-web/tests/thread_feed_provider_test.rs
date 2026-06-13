#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::{
    NewTabIds, RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet, TabKind,
    WorkspaceIds, create_workspace, open_configured_tab,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_web::sqlite_store::{sqlite_event_put, sqlite_relay_set_put, sqlite_workspace_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const SELECTED_RELAY: &str = "wss://selected.example";

#[wasm_bindgen_test(async)]
async fn rust_thread_tab_loads_cached_root_and_reply_from_host_provider() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("thread-provider");
    if let Err(error) = seed_thread_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Thread partial").await?;
    wait_for_text("cached thread root").await?;
    wait_for_text("cached thread parent").await?;
    wait_for_text("cached thread reply").await?;
    wait_for_text("cached focused branch reply").await?;
    wait_for_text("relay Thread bootstrap reads run").await
}

async fn seed_thread_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(sqlite_workspace_put(&store, &workspace()).await)?;
    put_event(&store, root_event()).await?;
    put_event(&store, parent_event()).await?;
    put_event(&store, reply_event()).await?;
    put_event(&store, branch_reply_event()).await?;
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

fn workspace() -> lkjstr_storage::WorkspaceRecord {
    let mut config = BTreeMap::new();
    config.insert("eventId".to_owned(), id(3));
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
        TabKind::Thread,
        NewTabIds {
            tab_id: "thread-tab".to_owned(),
        },
        config,
        2,
    )
}

fn relay_set() -> RelaySet {
    RelaySet {
        id: "thread-test-relays".to_owned(),
        name: "Thread Test Relays".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: SELECTED_RELAY.to_owned(),
            label: "Selected".to_owned(),
            enabled: true,
            read: true,
            write: false,
            state: RelayConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            updated_at: 9,
            health: RelayHealth::default(),
        }],
        updated_at: 9,
    }
}

fn root_event() -> NostrEvent {
    event(1, Vec::new(), "cached thread root")
}

fn parent_event() -> NostrEvent {
    event(2, Vec::new(), "cached thread parent")
}

fn reply_event() -> NostrEvent {
    event(
        3,
        vec![
            vec!["e".to_owned(), id(1), String::new(), "root".to_owned()],
            vec!["e".to_owned(), id(2), String::new(), "reply".to_owned()],
        ],
        "cached thread reply",
    )
}

fn branch_reply_event() -> NostrEvent {
    event(
        4,
        vec![vec!["e".to_owned(), id(3)]],
        "cached focused branch reply",
    )
}

fn event(value: u64, tags: Vec<Vec<String>>, content: &str) -> NostrEvent {
    NostrEvent {
        id: id(value),
        pubkey: "a".repeat(64),
        created_at: 1_700_000_000 + value,
        kind: KIND_TEXT_NOTE,
        tags,
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
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

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
