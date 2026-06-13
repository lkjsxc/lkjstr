#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod followees_route_provider_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, reset_shells, store_for, test_db_name, wait_for_text,
};
use followees_route_provider_support::{
    followees_socket_urls, install_partial_followees_websocket, restore_websocket,
};
use lkjstr_domain::{
    NewTabIds, RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet, TabKind,
    WorkspaceIds, create_workspace, open_configured_tab,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, NostrEvent, normalize_relay_url};
use lkjstr_storage::{AuthorRelayRouteRecord, StorageOutcome};
use lkjstr_web::sqlite_store::{
    sqlite_author_routes_put, sqlite_relay_set_put, sqlite_workspace_put,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const NIP65_RELAY: &str = "wss://followees-nip65.example";
const PROVENANCE_RELAY: &str = "wss://followees-provenance.example";
const TARGET_ROUTE_RELAY: &str = "wss://followees-target.example";
const DISABLED_ROUTE_RELAY: &str = "wss://followees-disabled.example";

#[wasm_bindgen_test(async)]
async fn rust_followees_discovers_follow_list_from_stored_routes() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("followees-route-provider");
    let target = pubkey("a");
    let followed = pubkey("b");
    if let Err(error) = seed_followees_route_cache(&db_name, &target).await {
        return skip_unavailable_worker(error);
    }
    let empty_route = normalize_relay_url(NIP65_RELAY).ok_or_else(|| js_error("bad route"))?;
    install_partial_followees_websocket(&follow_event(&target, &followed), &empty_route)?;
    let result = open_route_backed_followees(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_route_backed_followees(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Following").await?;
    wait_for_text("Loading following list...").await?;
    wait_for_text("Public follow list found.").await?;
    wait_for_text("route friend").await?;
    assert_requested(NIP65_RELAY)?;
    assert_requested(PROVENANCE_RELAY)?;
    assert_requested(TARGET_ROUTE_RELAY)?;
    assert_not_requested(DISABLED_ROUTE_RELAY)
}

async fn seed_followees_route_cache(db_name: &str, target: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &disabled_route_relay_set()).await)?;
    assert_ok(
        sqlite_author_routes_put(
            &store,
            &[
                route(target, "nip65", NIP65_RELAY),
                route(target, "receipt", PROVENANCE_RELAY),
                route(target, "discovery", TARGET_ROUTE_RELAY),
                route(target, "hint", DISABLED_ROUTE_RELAY),
            ],
        )
        .await,
    )?;
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

fn route(pubkey: &str, route_kind: &str, relay_url: &str) -> AuthorRelayRouteRecord {
    AuthorRelayRouteRecord {
        pubkey: pubkey.to_owned(),
        relay_url: relay_url.to_owned(),
        route_kind: route_kind.to_owned(),
        evidence_json: "{}".to_owned(),
        updated_at_ms: 10,
        expires_at_ms: None,
    }
}

fn disabled_route_relay_set() -> RelaySet {
    RelaySet {
        id: "followees-disabled-routes".to_owned(),
        name: "Followees Disabled Routes".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: DISABLED_ROUTE_RELAY.to_owned(),
            label: "Disabled Route".to_owned(),
            enabled: false,
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

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind: KIND_FOLLOW_LIST,
        tags: vec![vec![
            "p".to_owned(),
            followed_pubkey.to_owned(),
            PROVENANCE_RELAY.to_owned(),
            "route friend".to_owned(),
        ]],
        content: String::new(),
        sig: "f".repeat(128),
    }
}

fn assert_requested(relay_url: &str) -> Result<(), JsValue> {
    let expected = normalize_relay_url(relay_url).ok_or_else(|| js_error("bad route relay"))?;
    if followees_socket_urls().iter().any(|url| url == &expected) {
        return Ok(());
    }
    Err(js_error("expected Followees route relay request"))
}

fn assert_not_requested(relay_url: &str) -> Result<(), JsValue> {
    let expected = normalize_relay_url(relay_url).ok_or_else(|| js_error("bad route relay"))?;
    if followees_socket_urls().iter().any(|url| url == &expected) {
        return Err(js_error("disabled Followees route relay was requested"));
    }
    Ok(())
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
