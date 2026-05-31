#![cfg(target_arch = "wasm32")]

use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, parse_secret_key_hex};
use serde_json::Value;
use wasm_bindgen::prelude::JsValue;
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

#[wasm_bindgen_test]
fn mounts_rust_workspace_shell() -> Result<(), JsValue> {
    mount_rust_workspace_shell();
    let document = document()?;
    let shell = document
        .query_selector("[data-testid='rust-workspace-shell']")?
        .ok_or_else(|| js_error("missing rust workspace shell"))?;
    let text = shell.text_content().unwrap_or_default();
    assert!(text.contains("Welcome"));
    assert!(text.contains("Accounts"));
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

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}
