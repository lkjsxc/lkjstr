#![cfg(target_arch = "wasm32")]
mod accounts_selector_test_support;
mod user_timeline_relay_provider_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::LKJSXC_TIMELINE_PUBKEY;
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent, normalize_relay_url};
use lkjstr_storage::{
    AuthorRelayRouteRecord, StorageOutcome, StoredEventRecord, sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{sqlite_author_routes_put, sqlite_event_put, sqlite_relay_set_put};
use user_timeline_relay_provider_support::{
    install_partial_follow_list_websocket, relay_set, restore_websocket, user_timeline_socket_urls,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const NIP65_RELAY: &str = "wss://author-route.example";
const PROVENANCE_RELAY: &str = "wss://provenance-route.example";
const TARGET_ROUTE_RELAY: &str = "wss://target-route.example";
const DISABLED_ROUTE_RELAY: &str = "wss://disabled-route.example";

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_discovers_follow_list_from_stored_route_groups() -> Result<(), JsValue>
{
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-route-provider");
    let followed = pubkey("b");
    if let Err(error) = seed_user_timeline_route_cache(&db_name, &followed).await {
        return skip_unavailable_worker(error);
    }
    let follow = follow_event(LKJSXC_TIMELINE_PUBKEY, &followed);
    let empty_route = normalize_relay_url(NIP65_RELAY).ok_or_else(|| js_error("bad route"))?;
    install_partial_follow_list_websocket(&follow, &empty_route)?;
    let result = open_route_backed_user_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_route_backed_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("lkjsxc").await?;
    click("[data-testid='new-tab-option-user-timeline']")?;
    wait_for_text("route discovered user timeline event").await?;
    wait_for_text("User Timeline partial.").await?;
    wait_for_text("NIP-65 route wss://author-route.example/ ended without").await?;
    assert_requested(NIP65_RELAY)?;
    assert_requested(PROVENANCE_RELAY)?;
    assert_requested(TARGET_ROUTE_RELAY)?;
    assert_not_requested(DISABLED_ROUTE_RELAY)?;
    Ok(())
}

async fn seed_user_timeline_route_cache(
    db_name: &str,
    followed_pubkey: &str,
) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &disabled_route_relay_set()).await)?;
    assert_ok(
        sqlite_author_routes_put(
            &store,
            &[
                route("nip65", NIP65_RELAY),
                route("receipt", PROVENANCE_RELAY),
                route("discovery", TARGET_ROUTE_RELAY),
                route("hint", DISABLED_ROUTE_RELAY),
            ],
        )
        .await,
    )?;
    put_event(
        &store,
        event(
            "2",
            followed_pubkey,
            KIND_TEXT_NOTE,
            "route discovered user timeline event",
            Vec::new(),
        ),
    )
    .await?;
    assert_ok(client.close().await)
}

async fn put_event(
    store: &lkjstr_web::sqlite_store::SqliteStore,
    event: NostrEvent,
) -> Result<(), JsValue> {
    let relay = sqlite_event_relay_row(&event.id, NIP65_RELAY, 10, "cache");
    let row = StoredEventRecord {
        event,
        received_at_ms: 10,
        updated_at_ms: 11,
    };
    assert_ok(sqlite_event_put(store, &row, &[relay]).await)
}

fn route(route_kind: &str, relay_url: &str) -> AuthorRelayRouteRecord {
    AuthorRelayRouteRecord {
        pubkey: LKJSXC_TIMELINE_PUBKEY.to_owned(),
        relay_url: relay_url.to_owned(),
        route_kind: route_kind.to_owned(),
        evidence_json: "{}".to_owned(),
        updated_at_ms: 10,
        expires_at_ms: None,
    }
}

fn assert_requested(relay_url: &str) -> Result<(), JsValue> {
    let expected = normalize_relay_url(relay_url).ok_or_else(|| js_error("bad route relay"))?;
    if user_timeline_socket_urls()
        .iter()
        .any(|url| url == &expected)
    {
        return Ok(());
    }
    Err(js_error("expected User Timeline route relay request"))
}

fn assert_not_requested(relay_url: &str) -> Result<(), JsValue> {
    let expected = normalize_relay_url(relay_url).ok_or_else(|| js_error("bad route relay"))?;
    if user_timeline_socket_urls()
        .iter()
        .any(|url| url == &expected)
    {
        return Err(js_error("disabled User Timeline route relay was requested"));
    }
    Ok(())
}

fn disabled_route_relay_set() -> lkjstr_domain::RelaySet {
    let mut set = relay_set();
    if let Some(relay) = set.relays.first_mut() {
        relay.url = DISABLED_ROUTE_RELAY.to_owned();
        relay.enabled = false;
    }
    set
}

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    event(
        "1",
        pubkey,
        KIND_FOLLOW_LIST,
        "",
        vec![vec!["p".to_owned(), followed_pubkey.to_owned()]],
    )
}

fn event(
    id_prefix: &str,
    pubkey: &str,
    kind: u64,
    content: &str,
    tags: Vec<Vec<String>>,
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
        other => Err(js_error(
            other.problem().map_or("storage failed", |p| p.reason),
        )),
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
