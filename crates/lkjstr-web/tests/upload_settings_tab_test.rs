#![cfg(target_arch = "wasm32")]

use lkjstr_storage::StorageOutcome;
use serde_json::json;
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::{indexed_db, mount_rust_workspace_shell_from_db};

wasm_bindgen_test_configure!(run_in_browser);

const FETCH_MOCK: &str = "window.fetch = async (input) => { const url = String(input); if (url === 'https://media.example/.well-known/nostr/nip96.json') return new Response(JSON.stringify({ api_url: 'https://media.example/upload' }), { status: 200, headers: { 'content-type': 'application/json' } }); return new Response('', { status: 404 }); };";

#[wasm_bindgen_test(async)]
async fn rust_upload_settings_saves_and_discovers_endpoint() -> Result<(), JsValue> {
    reset_shells()?;
    install_fetch_mock()?;
    let db_name = test_db_name();
    mount_rust_workspace_shell_from_db(db_name.clone());
    open_upload_settings_tab().await?;
    wait_for_text("nostr.build").await?;
    click("[value='custom']")?;
    wait_for_setting(&db_name, "tweet.mediaUploadProvider", json!("custom")).await?;
    set_input(
        "[aria-label='Custom upload server']",
        "https://media.example",
    )?;
    wait_for_setting(
        &db_name,
        "tweet.mediaUploadCustomServer",
        json!("https://media.example"),
    )
    .await?;
    wait_for_text("Custom server saved.").await?;
    dispatch_click(".upload-settings-tab button")?;
    wait_for_text("Discovery OK: https://media.example/upload").await?;
    set_checkbox("input[type='checkbox']", false)?;
    wait_for_setting(&db_name, "tweet.mediaUploadNoTransform", json!(false)).await
}

async fn open_upload_settings_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_selector("[data-testid='new-tab-open-upload-settings']").await?;
    click("[data-testid='new-tab-open-upload-settings']")
}

async fn wait_for_setting(
    db_name: &str,
    key: &str,
    value: serde_json::Value,
) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        match indexed_db::settings_store::setting_get(db_name, key).await {
            StorageOutcome::Ok(Some(row)) if row.value == value => return Ok(()),
            StorageOutcome::Ok(_) => {}
            outcome => return Err(outcome_error(outcome.problem())),
        }
    }
    Err(js_error(&format!("timed out waiting for setting {key}")))
}

fn install_fetch_mock() -> Result<(), JsValue> {
    js_sys::eval(FETCH_MOCK).map(|_| ())
}

fn set_input(selector: &str, value: &str) -> Result<(), JsValue> {
    let input = input(selector)?;
    input.set_value(value);
    input.dispatch_event(&bubbling_event("input")?)?;
    input.dispatch_event(&bubbling_event("change")?)?;
    Ok(())
}

fn set_checkbox(selector: &str, checked: bool) -> Result<(), JsValue> {
    let input = input(selector)?;
    input.set_checked(checked);
    input.dispatch_event(&bubbling_event("change")?)?;
    Ok(())
}

fn input(selector: &str) -> Result<web_sys::HtmlInputElement, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing input"))?
        .dyn_into::<web_sys::HtmlInputElement>()
        .map_err(JsValue::from)
}

fn click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?
        .dyn_into::<web_sys::HtmlElement>()?
        .click();
    Ok(())
}

fn dispatch_click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?
        .dispatch_event(&bubbling_event("click")?)?;
    Ok(())
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!(
        "timed out waiting for text: {text}: {}",
        document_text()?
    )))
}

async fn wait_for_selector(selector: &str) -> Result<(), JsValue> {
    for _ in 0..80 {
        next_task().await?;
        if document()?.query_selector(selector)?.is_some() {
            return Ok(());
        }
    }
    Err(js_error(&format!("timed out waiting for {selector}")))
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
        if let Err(error) = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0)
        {
            let _result = reject.call1(&JsValue::NULL, &error);
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

fn bubbling_event(name: &str) -> Result<web_sys::Event, JsValue> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    web_sys::Event::new_with_event_init_dict(name, &init)
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

fn outcome_error(problem: Option<&lkjstr_storage::StorageProblem>) -> JsValue {
    match problem {
        Some(problem) => js_error(problem.reason),
        None => js_error("upload settings storage failed"),
    }
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!(
        "lkjstr-upload-settings-{}-{random}",
        js_sys::Date::now() as u64
    )
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
