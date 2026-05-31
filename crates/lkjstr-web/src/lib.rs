#![doc = "Rust/WASM browser bridge for lkjstr."]

mod protocol_bridge;
mod response;

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn start() {
    if !is_wasm_bindgen_test_runner() {
        mount_rust_workspace_shell();
    }
}

#[cfg(target_arch = "wasm32")]
pub fn mount_rust_workspace_shell() {
    lkjstr_ui::mount_app();
}

#[cfg(target_arch = "wasm32")]
fn is_wasm_bindgen_test_runner() -> bool {
    web_sys::window()
        .and_then(|window| window.location().pathname().ok())
        .is_some_and(|path| path.contains("wasm-bindgen-test"))
}

#[wasm_bindgen]
pub fn validate_event_json(json: &str) -> JsValue {
    protocol_bridge::validate_event_json(json)
}

#[wasm_bindgen]
pub fn verify_event_json(json: &str) -> JsValue {
    protocol_bridge::verify_event_json(json)
}

#[wasm_bindgen]
pub fn encode_client_message_json(json: &str) -> Result<String, JsValue> {
    protocol_bridge::encode_client_message_json(json)
}

#[wasm_bindgen]
pub fn decode_relay_message_json(json: &str) -> JsValue {
    protocol_bridge::decode_relay_message_json(json)
}

#[wasm_bindgen]
pub fn decode_nip19(text: &str) -> JsValue {
    protocol_bridge::decode_nip19_json(text)
}

#[wasm_bindgen]
pub fn encode_nip19(json: &str) -> Result<String, JsValue> {
    protocol_bridge::encode_nip19_json(json)
}
