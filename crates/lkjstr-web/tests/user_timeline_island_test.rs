#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{next_task, reset_shells, wait_for_text};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn user_timeline_island_mounts_and_unmounts() -> Result<(), JsValue> {
    reset_shells()?;
    lkjstr_web::reset_user_timeline_diagnostics_for_test();
    let host = host_element()?;
    body()?.append_child(&host)?;

    let mut handle = lkjstr_web::mount_user_timeline_tab(
        host.clone(),
        "user-timeline-island-test".to_owned(),
        String::new(),
        no_op(),
        no_op(),
        no_op(),
    );

    wait_for_text("User Timeline target unavailable.").await?;
    assert_snapshot_count("outcomes", "missing-pubkey", 1)?;
    assert_snapshot_count("reasons", "missing-pubkey", 1)?;
    handle.unmount();
    next_task().await?;
    assert!(!host_text(&host).contains("User Timeline target unavailable."));
    host.remove();
    Ok(())
}

fn assert_snapshot_count(group: &str, key: &str, expected: u32) -> Result<(), JsValue> {
    let snapshot = lkjstr_web::user_timeline_diagnostics_snapshot();
    let rows = js_sys::Reflect::get(&snapshot, &JsValue::from_str(group))?;
    let array = js_sys::Array::from(&rows);
    for row in array.iter() {
        let row_key = js_sys::Reflect::get(&row, &JsValue::from_str("key"))?;
        let count = js_sys::Reflect::get(&row, &JsValue::from_str("count"))?;
        if row_key.as_string().as_deref() == Some(key) {
            assert_eq!(count.as_f64().unwrap_or_default() as u32, expected);
            return Ok(());
        }
    }
    Err(js_error(&format!(
        "missing User Timeline stat {group}:{key}"
    )))
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
