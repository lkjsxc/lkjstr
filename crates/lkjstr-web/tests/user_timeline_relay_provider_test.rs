#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod user_timeline_relay_provider_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_app::UserTimelineFeedStatus;
use lkjstr_domain::LKJSXC_TIMELINE_PUBKEY;
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent, NostrTag};
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};
use lkjstr_web::sqlite_store::{sqlite_event_put, sqlite_relay_set_put};
use lkjstr_web::user_timeline_relay_test_api::{
    user_timeline_relay_match_probe, user_timeline_relay_plan_probe,
    user_timeline_relay_store_probe,
};
use user_timeline_relay_provider_support::{
    SELECTED_RELAY, install_follow_list_websocket, relay_set, restore_websocket,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn user_timeline_relay_plans_selected_kind3_route() -> Result<(), JsValue> {
    let plan = user_timeline_relay_plan_probe().ok_or_else(|| js_error("missing plan"))?;
    let matches = user_timeline_relay_match_probe().ok_or_else(|| js_error("missing match"))?;

    assert_eq!(plan.relays, vec![SELECTED_RELAY]);
    assert_eq!(plan.selected_kinds, vec![KIND_FOLLOW_LIST]);
    assert!(plan.missing_relay_kinds.is_empty());
    assert!(matches.follow_list);
    assert!(!matches.note);
    assert!(!matches.wrong_author);
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn user_timeline_relay_store_rebuilds_follow_graph() -> Result<(), JsValue> {
    let db_name = test_db_name("user-timeline-relay-store");
    let probe = user_timeline_relay_store_probe(&db_name, WORKER_URL).await;
    if let Some(problem) = probe.store_problem {
        if problem.contains("unavailable") {
            return Ok(());
        }
        return Err(js_error(&problem));
    }

    assert_eq!(probe.status, UserTimelineFeedStatus::Partial);
    assert_eq!(probe.author_count, 2);
    assert_eq!(probe.event_count, 1);
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_discovers_follow_list_from_selected_relay() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-relay-provider");
    let followed = pubkey("b");
    if let Err(error) = seed_user_timeline_route_cache(&db_name, &followed).await {
        return skip_unavailable_worker(error);
    }
    let follow = follow_event(LKJSXC_TIMELINE_PUBKEY, &followed);
    install_follow_list_websocket(&follow)?;
    let result = open_relay_backed_user_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_relay_backed_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("lkjsxc").await?;
    click("[data-testid='new-tab-option-user-timeline']")?;
    wait_for_text("relay discovered user timeline event").await?;
    wait_for_text("User Timeline partial.").await?;
    wait_for_text("Cached User Timeline rows loaded without complete coverage proof.").await
}

async fn seed_user_timeline_route_cache(
    db_name: &str,
    followed_pubkey: &str,
) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    put_event(
        &store,
        event(
            "2",
            followed_pubkey,
            KIND_TEXT_NOTE,
            Vec::new(),
            "relay discovered user timeline event",
        ),
    )
    .await?;
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

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    event(
        "1",
        pubkey,
        KIND_FOLLOW_LIST,
        vec![vec!["p".to_owned(), followed_pubkey.to_owned()]],
        "",
    )
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
