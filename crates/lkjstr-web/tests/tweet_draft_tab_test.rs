#![cfg(target_arch = "wasm32")]

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::mount_rust_workspace_shell_from_db;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_tweet_tab_renders_and_reports_storage_state() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_from_db(test_db_name());
    open_tweet_tab().await?;
    wait_for_textarea_value("[aria-label='Tweet content']", "").await?;
    set_textarea("[aria-label='Tweet content']", "edited rust draft")?;
    if let Err(error) = wait_for_text("Draft saved.").await {
        if document_text()?.contains("Draft save failed")
            || document_text()?.contains("Tweet draft unavailable")
        {
            return Ok(());
        }
        return Err(error);
    }
    Ok(())
}

async fn open_tweet_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-tweet']")?;
    wait_for_text("Publishing waits for Rust signing").await
}

async fn wait_for_textarea_value(selector: &str, expected: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if textarea(selector).is_ok_and(|item| item.value() == expected) {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for textarea value"))
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for text"))
}

fn set_textarea(selector: &str, value: &str) -> Result<(), JsValue> {
    let textarea = textarea(selector)?;
    textarea.set_value(value);
    textarea.dispatch_event(&bubbling_event("input")?)?;
    Ok(())
}

fn textarea(selector: &str) -> Result<web_sys::HtmlTextAreaElement, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing textarea"))?
        .dyn_into::<web_sys::HtmlTextAreaElement>()
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

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
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

fn bubbling_event(name: &str) -> Result<web_sys::Event, JsValue> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    web_sys::Event::new_with_event_init_dict(name, &init)
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-tweet-draft-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
