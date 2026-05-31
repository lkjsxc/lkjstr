#![doc = "Rust/WASM browser bridge for lkjstr."]

mod protocol_bridge;
mod response;

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

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
