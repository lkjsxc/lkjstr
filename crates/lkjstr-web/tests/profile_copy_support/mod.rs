use std::sync::{Mutex, MutexGuard};

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;

pub(crate) async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!("timed out waiting for text: {text}")))
}

pub(crate) fn click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?
        .dyn_into::<web_sys::HtmlElement>()?
        .click();
    Ok(())
}

pub(crate) fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

pub(crate) fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}

pub(crate) fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
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
