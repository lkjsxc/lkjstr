#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, account, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_METADATA, NostrEvent, normalize_relay_url};
use lkjstr_storage::{
    AuthorRelayRouteRecord, StorageOutcome, StoredEventRecord, sqlite_event_relay_row,
};
use lkjstr_web::sqlite_store::{sqlite_account_put, sqlite_author_routes_put, sqlite_event_put};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

const AUTHOR_RELAY: &str = "wss://author.example";

#[wasm_bindgen_test(async)]
async fn rust_profile_header_renders_cached_metadata_and_follow_count() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("profile-header-known");
    if let Err(error) = seed_profile_header(&db_name, true).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_profile_tab().await?;
    wait_for_text("Rustacean").await?;
    wait_for_text("2 following").await?;
    wait_for_text("about text").await?;
    assert_attr(
        ".profile-card__avatar img",
        "src",
        "https://media.example/avatar.png",
    )?;
    assert_attr(
        ".profile-card__banner",
        "src",
        "https://media.example/banner.png",
    )?;
    assert_absent("0 following")
}

#[wasm_bindgen_test(async)]
async fn rust_profile_header_does_not_invent_zero_following() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("profile-header-loading");
    if let Err(error) = seed_profile_header(&db_name, false).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_profile_tab().await?;
    wait_for_text("Rustacean").await?;
    wait_for_text("Loading following...").await?;
    assert_absent("0 following")
}

async fn open_profile_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("My Profile").await?;
    click("[data-testid='new-tab-option-profile']")
}

async fn seed_profile_header(db_name: &str, follow_list: bool) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let account = account("a", 7)?;
    normalize_relay_url(AUTHOR_RELAY).ok_or_else(|| js_error("bad relay"))?;
    assert_ok(sqlite_account_put(&store, &account).await)?;
    assert_ok(sqlite_author_routes_put(&store, &[route(&account.pubkey)]).await)?;
    put_event(
        &store,
        event(
            "0",
            &account.pubkey,
            KIND_METADATA,
            r#"{"display_name":"Rustacean","about":"about text","website":"example.com","picture":"https://media.example/avatar.png","banner":"https://media.example/banner.png"}"#,
            Vec::new(),
        ),
    )
    .await?;
    if follow_list {
        put_event(
            &store,
            event(
                "3",
                &account.pubkey,
                KIND_FOLLOW_LIST,
                "",
                vec![
                    vec!["p".to_owned(), "b".repeat(64)],
                    vec!["p".to_owned(), "b".repeat(64)],
                    vec!["p".to_owned(), "c".repeat(64)],
                ],
            ),
        )
        .await?;
    }
    assert_ok(client.close().await)
}

async fn put_event(
    store: &lkjstr_web::sqlite_store::SqliteStore,
    event: NostrEvent,
) -> Result<(), JsValue> {
    let relay = sqlite_event_relay_row(&event.id, AUTHOR_RELAY, 10, "cache");
    assert_ok(
        sqlite_event_put(
            store,
            &StoredEventRecord {
                event,
                received_at_ms: 10,
                updated_at_ms: 11,
            },
            &[relay],
        )
        .await,
    )
}

fn route(pubkey: &str) -> AuthorRelayRouteRecord {
    AuthorRelayRouteRecord {
        pubkey: pubkey.to_owned(),
        relay_url: AUTHOR_RELAY.to_owned(),
        route_kind: "nip65".to_owned(),
        evidence_json: "{}".to_owned(),
        updated_at_ms: 10,
        expires_at_ms: None,
    }
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
        created_at: ((js_sys::Date::now() / 1000.0) as u64).saturating_sub(2),
        kind,
        tags,
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn assert_absent(text: &str) -> Result<(), JsValue> {
    if document_text()?.contains(text) {
        return Err(js_error(&format!("unexpected text: {text}")));
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.body())
        .map(|body| body.text_content().unwrap_or_default())
        .ok_or_else(|| js_error("missing document text"))
}

fn assert_attr(selector: &str, name: &str, expected: &str) -> Result<(), JsValue> {
    let value = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.query_selector(selector).ok().flatten())
        .and_then(|element| element.get_attribute(name))
        .ok_or_else(|| js_error(&format!("missing attribute {name}")))?;
    if value == expected {
        return Ok(());
    }
    Err(js_error(&format!("unexpected attribute {name}: {value}")))
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
