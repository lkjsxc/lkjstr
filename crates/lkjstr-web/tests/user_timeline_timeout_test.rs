#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;
mod user_timeline_relay_provider_support;

use accounts_selector_test_support::{
    WORKER_URL, clear_legacy, click, reset_shells, store_for, test_db_name, wait_for_text,
};
use lkjstr_storage::StorageOutcome;
use lkjstr_web::sqlite_store::sqlite_relay_set_put;
use user_timeline_relay_provider_support::{
    SELECTED_RELAY, relay_set, restore_websocket, user_timeline_request_count,
};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_user_timeline_timeout_selected_relay_renders_retry_diagnostic() -> Result<(), JsValue>
{
    reset_shells()?;
    clear_legacy()?;
    let db_name = test_db_name("user-timeline-timeout");
    if let Err(error) = seed_user_timeline_route_cache(&db_name).await {
        return skip_unavailable_worker(error);
    }
    install_hanging_follow_list_websocket()?;
    let result = open_timeout_user_timeline(db_name).await;
    let restore = restore_websocket();
    result.and(restore)
}

async fn open_timeout_user_timeline(db_name: String) -> Result<(), JsValue> {
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, WORKER_URL.to_owned());
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_text("lkjsxc").await?;
    click("[data-testid='new-tab-option-user-timeline']")?;
    wait_for_text("Loading public timeline...").await?;
    wait_ms(5_200).await?;
    wait_for_text("User Timeline discovery failed.").await?;
    wait_for_text("Retry available").await?;
    wait_for_text(&format!(
        "Selected relay {SELECTED_RELAY} timed out before returning a public follow-list event."
    ))
    .await?;
    if user_timeline_request_count() == 0 {
        return Err(js_error("expected User Timeline timeout relay request"));
    }
    Ok(())
}

async fn seed_user_timeline_route_cache(db_name: &str) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    assert_ok(sqlite_relay_set_put(&store, &relay_set()).await)?;
    assert_ok(client.close().await)
}

fn install_hanging_follow_list_websocket() -> Result<(), JsValue> {
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
            if (frame[0] === 'REQ') {
              window.__lkjstrUserTimelineReqCount += 1;
            }
          }
          close() {
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
}

async fn wait_ms(delay_ms: i32) -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let callback = Closure::once_into_js(move || {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let timeout = web_sys::window().and_then(|window| {
            window
                .set_timeout_with_callback_and_timeout_and_arguments_0(
                    callback.unchecked_ref(),
                    delay_ms,
                )
                .ok()
        });
        if timeout.is_none() {
            let _ = reject.call1(&JsValue::NULL, &js_error("missing timeout"));
        }
    });
    JsFuture::from(promise).await.map(|_| ())
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
