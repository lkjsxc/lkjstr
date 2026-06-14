#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::sqlite_relay_set_put;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_custom_request_tab_plans_selected_relay_demand() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("custom-request-ready");
    if let Err(error) = seed_relay_set(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(
        db_name.clone(),
        WORKER_URL.to_owned(),
    );
    open_custom_request_tab().await?;
    assert!(!document_text()?.contains("Rust Custom Request body is not converted yet."));

    click(".lkjstr-custom-request-controls button[type='submit']")?;
    wait_for_text("Ready for relay read: 1 relay target.").await?;
    input_value("textarea[aria-label='Custom request JSON']", "{")?;
    click(".lkjstr-custom-request-controls button[type='submit']")?;
    wait_for_text("Invalid request: InvalidJson.").await
}

#[wasm_bindgen_test(async)]
async fn rust_custom_request_tab_renders_no_relay_state() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("custom-request-no-relay");
    if let Err(error) = seed_empty_relay_set(&db_name).await {
        return skip_unavailable_worker(error);
    }

    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    open_custom_request_tab().await?;
    click(".lkjstr-custom-request-controls button[type='submit']")?;
    wait_for_text("No enabled relay is available for this request.").await
}

async fn open_custom_request_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("Custom Request").await?;
    click("[data-testid='new-tab-option-custom-request']")?;
    wait_for_text("Enter request JSON.").await
}

async fn seed_relay_set(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(client.close().await)
}

async fn seed_empty_relay_set(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &empty_relay_set()).await)?;
    assert_ok(client.close().await)
}

fn relay_set() -> RelaySet {
    RelaySet {
        id: "custom-request-relays".to_owned(),
        name: "Custom Request Relays".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![relay_record()],
        updated_at: 10,
    }
}

fn empty_relay_set() -> RelaySet {
    RelaySet {
        id: "custom-request-empty-relays".to_owned(),
        name: "Custom Request Empty Relays".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: Vec::new(),
        updated_at: 10,
    }
}

fn relay_record() -> RelayRecord {
    RelayRecord {
        url: "wss://selected.example".to_owned(),
        label: "selected".to_owned(),
        enabled: true,
        read: true,
        write: true,
        state: RelayConnectionState::Idle,
        last_error: None,
        last_connected_at: None,
        updated_at: 10,
        health: RelayHealth::default(),
    }
}

fn input_value(selector: &str, value: &str) -> Result<(), JsValue> {
    let input = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing custom request input"))?
        .dyn_into::<web_sys::HtmlTextAreaElement>()?;
    input.set_value(value);
    input.dispatch_event(&bubbling_event("input")?)?;
    input.dispatch_event(&bubbling_event("change")?)?;
    Ok(())
}

fn bubbling_event(name: &str) -> Result<web_sys::Event, JsValue> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    web_sys::Event::new_with_event_init_dict(name, &init)
}

fn document_text() -> Result<String, JsValue> {
    document()?
        .body()
        .and_then(|body| body.text_content())
        .ok_or_else(|| js_error("missing document text"))
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

fn skip_unavailable_worker(error: JsValue) -> Result<(), JsValue> {
    if format!("{error:?}").contains("unavailable") {
        return Ok(());
    }
    Err(error)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
