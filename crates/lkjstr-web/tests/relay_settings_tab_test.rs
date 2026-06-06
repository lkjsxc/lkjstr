#![cfg(target_arch = "wasm32")]

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::mount_rust_workspace_shell_from_db;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_relay_settings_renders_or_reports_storage_state() -> Result<(), JsValue> {
    reset_shells()?;
    clear_selected_relay_set()?;
    let db_name = test_db_name();
    mount_rust_workspace_shell_from_db(db_name.clone());
    open_relay_settings_tab().await?;
    wait_for_text("Relay Settings").await?;
    if document_text()?.contains("Relay settings unavailable") {
        return Ok(());
    }
    if let Err(error) = wait_for_text("wss://relay.damus.io").await {
        if document_text()?.contains("Relay settings unavailable") {
            return Ok(());
        }
        return Err(error);
    }
    set_input("[aria-label='Public Default relay URL']", "relay.example")?;
    next_task().await?;
    click_button_with_text("Add relay")?;
    wait_for_text("wss://relay.example/").await?;
    Ok(())
}

async fn open_relay_settings_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[aria-label='New tab']")?;
    wait_for_selector("[data-testid='new-tab-open-relay-settings']").await?;
    click("[data-testid='new-tab-open-relay-settings']")
}

fn set_input(selector: &str, value: &str) -> Result<(), JsValue> {
    let input = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing input"))?;
    input
        .dyn_ref::<web_sys::HtmlInputElement>()
        .ok_or_else(|| js_error("element is not an input"))?
        .set_value(value);
    input.dispatch_event(&bubbling_event("input")?)?;
    input.dispatch_event(&bubbling_event("change")?)?;
    Ok(())
}

fn click_button_with_text(text: &str) -> Result<(), JsValue> {
    let buttons = document()?.query_selector_all("button")?;
    for index in 0..buttons.length() {
        if let Some(button) = buttons.item(index)
            && button.text_content().unwrap_or_default().contains(text)
        {
            button.dyn_into::<web_sys::HtmlElement>()?.click();
            return Ok(());
        }
    }
    Err(js_error("missing text button"))
}

fn click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?
        .dyn_into::<web_sys::HtmlElement>()?
        .click();
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
    Err(js_error(&format!(
        "timed out waiting for selector: {selector}"
    )))
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

fn clear_selected_relay_set() -> Result<(), JsValue> {
    if let Some(storage) = web_sys::window()
        .ok_or_else(|| js_error("missing window"))?
        .local_storage()?
    {
        storage.remove_item("lkjstr.defaultRelaySetId")?;
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
    format!(
        "lkjstr-relay-settings-{}-{random}",
        js_sys::Date::now() as u64
    )
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
