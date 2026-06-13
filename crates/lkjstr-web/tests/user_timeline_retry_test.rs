#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod user_timeline_relay_provider_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::sqlite_relay_set_put;
use user_timeline_relay_provider_support::{
    SELECTED_RELAY, install_empty_follow_list_websocket, relay_set, restore_websocket,
    user_timeline_request_count,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_empty_selected_relay_renders_retry_diagnostic() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-retry");
    if let Err(error) = seed_user_timeline_route_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }
    install_empty_follow_list_websocket()?;
    let result = open_retryable_user_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_auth_selected_relay_renders_auth_diagnostic() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-auth");
    if let Err(error) = seed_user_timeline_route_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }
    install_auth_follow_list_websocket()?;
    let result = open_auth_required_user_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_rate_limited_selected_relay_renders_retry_diagnostic()
-> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-rate-limited");
    if let Err(error) = seed_user_timeline_route_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }
    install_rate_limited_follow_list_websocket()?;
    let result = open_rate_limited_user_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_retryable_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("lkjsxc").await?;
    click("[data-testid='new-tab-option-user-timeline']")?;
    wait_for_text("Loading public timeline...").await?;
    wait_for_text("User Timeline discovery failed.").await?;
    wait_for_text("Retry available").await?;
    wait_for_text(&format!(
        "Selected relay {SELECTED_RELAY} ended without a public follow-list event."
    ))
    .await?;
    if user_timeline_request_count() == 0 {
        return Err(js_error("expected User Timeline relay request"));
    }
    Ok(())
}

async fn open_auth_required_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("lkjsxc").await?;
    click("[data-testid='new-tab-option-user-timeline']")?;
    wait_for_text("Loading public timeline...").await?;
    wait_for_text("User Timeline relay auth required.").await?;
    wait_for_text("Auth required").await?;
    wait_for_text(&format!(
        "Selected relay {SELECTED_RELAY} requires relay authentication before reading the public follow-list."
    ))
    .await?;
    if user_timeline_request_count() == 0 {
        return Err(js_error("expected User Timeline auth relay request"));
    }
    Ok(())
}

async fn open_rate_limited_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("lkjsxc").await?;
    click("[data-testid='new-tab-option-user-timeline']")?;
    wait_for_text("Loading public timeline...").await?;
    wait_for_text("User Timeline relays rate limited.").await?;
    wait_for_text("Retry available").await?;
    wait_for_text(&format!(
        "Selected relay {SELECTED_RELAY} rate limited the public follow-list request."
    ))
    .await?;
    if user_timeline_request_count() == 0 {
        return Err(js_error("expected User Timeline rate limit request"));
    }
    Ok(())
}

async fn seed_user_timeline_route_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(client.close().await)
}

fn install_auth_follow_list_websocket() -> Result<(), JsValue> {
    install_relay_reply_websocket("auth", "")
}

fn install_rate_limited_follow_list_websocket() -> Result<(), JsValue> {
    install_relay_reply_websocket("closed", "rate-limited: slow")
}

fn install_relay_reply_websocket(kind: &str, message: &str) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrUserTimelineReplyKind"),
        &JsValue::from_str(kind),
    )?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrUserTimelineReplyMessage"),
        &JsValue::from_str(message),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrUserTimelineReqCount = 0;
        window.__lkjstrUserTimelineSocketUrls = [];
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            window.__lkjstrUserTimelineSocketUrls.push(url);
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            window.__lkjstrUserTimelineReqCount += 1;
            setTimeout(() => {
              const data = window.__lkjstrUserTimelineReplyKind === 'auth'
                ? ['AUTH', 'challenge']
                : ['CLOSED', sub, window.__lkjstrUserTimelineReplyMessage];
              this.onmessage && this.onmessage({
                data: JSON.stringify(data),
              });
            }, 0);
          }
          close() {
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
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
