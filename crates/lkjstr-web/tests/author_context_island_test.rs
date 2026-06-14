#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{next_task, reset_shells, wait_for_text};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn author_context_island_mounts_and_unmounts() -> Result<(), JsValue> {
    reset_shells()?;
    let host = host_element()?;
    body()?.append_child(&host)?;

    let mut handle = lkjstr_web::mount_author_context_tab(
        host.clone(),
        "author-context-island-test".to_owned(),
        String::new(),
        String::new(),
        no_op(),
        no_op(),
        no_op(),
    );

    wait_for_text("Author Context event unavailable.").await?;
    handle.unmount();
    next_task().await?;
    assert!(!host_text(&host).contains("Author Context event unavailable."));
    host.remove();
    Ok(())
}

fn host_element() -> Result<web_sys::HtmlElement, JsValue> {
    document()?
        .create_element("section")?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("host is not an HTML element"))
}

fn no_op() -> js_sys::Function {
    js_sys::Function::new_no_args("")
}

fn host_text(host: &web_sys::HtmlElement) -> String {
    host.text_content().unwrap_or_default()
}

fn body() -> Result<web_sys::HtmlElement, JsValue> {
    document()?
        .body()
        .ok_or_else(|| js_error("missing document body"))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
