#![cfg(target_arch = "wasm32")]

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::mount_rust_workspace_shell_from_db;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_log_tab_renders_durable_empty_state() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_from_db(test_db_name());
    wait_for_text("Welcome").await?;
    click("button[aria-label='New tab']")?;
    wait_for_text("lkjstr Log").await?;
    click("[data-testid='new-tab-option-relay-monitor']")?;
    wait_for_text("Clear durable log").await?;
    wait_for_text("No durable log rows").await?;
    Ok(())
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..80 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!("timed out waiting for text: {text}")))
}

async fn next_task() -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let Some(window) = web_sys::window() else {
            let _result = reject.call1(&JsValue::NULL, &js_error("missing window"));
            return;
        };
        let callback = Closure::once_into_js(move || {
            let _result = resolve.call0(&JsValue::NULL);
        });
        let result = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0);
        if let Err(error) = result {
            let _result = reject.call1(&JsValue::NULL, &error);
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

fn click(selector: &str) -> Result<(), JsValue> {
    let element = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing clickable element: {selector}")))?;
    let button = element
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("click target is not an html element"))?;
    button.click();
    Ok(())
}

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    let body = document()?
        .body()
        .ok_or_else(|| js_error("missing document body"))?;
    Ok(body.text_content().unwrap_or_default())
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-log-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
