#![cfg(target_arch = "wasm32")]

use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, parse_secret_key_hex};
use serde_json::Value;
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::{
    decode_nip19, decode_relay_message_json, encode_client_message_json, encode_nip19,
    mount_rust_workspace_shell, validate_event_json, verify_event_json,
};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn validates_and_verifies_signed_events() -> Result<(), JsValue> {
    let event = signed_event()?;
    let json = to_json(&event)?;
    let validated = value(validate_event_json(&json))?;
    assert_eq!(validated.get("ok").and_then(Value::as_bool), Some(true));
    let verified = value(verify_event_json(&json))?;
    assert_eq!(verified.get("ok").and_then(Value::as_bool), Some(true));
    Ok(())
}

#[wasm_bindgen_test]
fn encodes_and_decodes_relay_messages() -> Result<(), JsValue> {
    let event = signed_event()?;
    assert_eq!(
        encode_client_message_json(r#"["CLOSE","sub"]"#)?,
        r#"["CLOSE","sub"]"#
    );
    let relay_json = to_json(&serde_json::json!(["EVENT", "sub", event]))?;
    let decoded = value(decode_relay_message_json(&relay_json))?;
    assert_eq!(decoded.get("ok").and_then(Value::as_bool), Some(true));
    assert_eq!(
        decoded
            .get("data")
            .and_then(|data| data.get("type"))
            .and_then(Value::as_str),
        Some("EVENT")
    );
    Ok(())
}

#[wasm_bindgen_test]
fn encodes_and_decodes_nip19_entities() -> Result<(), JsValue> {
    let id = "ab".repeat(32);
    let encoded = encode_nip19(&format!(r#"{{"type":"note","data":"{id}"}}"#))?;
    let decoded = value(decode_nip19(&encoded))?;
    assert_eq!(decoded.get("ok").and_then(Value::as_bool), Some(true));
    assert_eq!(
        decoded
            .get("data")
            .and_then(|data| data.get("data"))
            .and_then(Value::as_str),
        Some(id.as_str())
    );
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn mounts_rust_workspace_shell() -> Result<(), JsValue> {
    reset_and_mount().await?;
    let document = document()?;
    let shell = document
        .query_selector("[data-testid='rust-workspace-shell']")?
        .ok_or_else(|| js_error("missing rust workspace shell"))?;
    let text = shell.text_content().unwrap_or_default();
    assert!(text.contains("Welcome"));
    assert!(text.contains("Accounts"));
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn welcome_and_new_tab_actions_use_rust_reducers() -> Result<(), JsValue> {
    reset_and_mount().await?;
    click("[data-testid='welcome-open-tweet']")?;
    next_task().await?;
    assert!(document_text()?.contains("The Rust Tweet body is not converted yet."));

    click(".lkjstr-activity-bar button")?;
    next_task().await?;
    click("[data-testid='new-tab-open-search']")?;
    next_task().await?;
    let text = document_text()?;
    assert!(text.contains("Search"));
    assert!(text.contains("The Rust Search body is not converted yet."));
    Ok(())
}

fn signed_event() -> Result<NostrEvent, JsValue> {
    let secret_hex = "01".repeat(32);
    let secret = parse_secret_key_hex(&secret_hex).ok_or_else(|| js_error("bad secret"))?;
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: Vec::new(),
            content: "wasm bridge".to_owned(),
        },
        &secret,
    )
    .map_err(|error| js_error(&format!("{error:?}")))
}

fn to_json<T: serde::Serialize>(value: &T) -> Result<String, JsValue> {
    serde_json::to_string(value).map_err(|error| js_error(&error.to_string()))
}

fn value(value: JsValue) -> Result<Value, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|error| js_error(&error.to_string()))
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}

async fn reset_and_mount() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell();
    wait_for_shell().await
}

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
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

fn document_text() -> Result<String, JsValue> {
    let body = document()?
        .body()
        .ok_or_else(|| js_error("missing document body"))?;
    Ok(body.text_content().unwrap_or_default())
}

async fn wait_for_shell() -> Result<(), JsValue> {
    for _ in 0..50 {
        next_task().await?;
        if document()?
            .query_selector("[data-testid='rust-workspace-shell']")?
            .is_some()
        {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for rust workspace shell"))
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

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}
