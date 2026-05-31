use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;

pub async fn nip07_public_key() -> Result<String, String> {
    let window = web_sys::window().ok_or_else(unavailable)?;
    let nostr =
        js_sys::Reflect::get(&window, &JsValue::from_str("nostr")).map_err(|_| unavailable())?;
    if nostr.is_undefined() || nostr.is_null() {
        return Err(unavailable());
    }
    let getter = js_sys::Reflect::get(&nostr, &JsValue::from_str("getPublicKey"))
        .map_err(|_| unavailable())?;
    let function = getter
        .dyn_into::<js_sys::Function>()
        .map_err(|_| unavailable())?;
    let value = function
        .call0(&nostr)
        .map_err(|_| "NIP-07 signer rejected access.".to_owned())?;
    let result = JsFuture::from(js_sys::Promise::resolve(&value))
        .await
        .map_err(|_| "NIP-07 signer rejected access.".to_owned())?;
    result
        .as_string()
        .ok_or_else(|| "NIP-07 signer returned an invalid public key.".to_owned())
}

fn unavailable() -> String {
    "NIP-07 signer unavailable.".to_owned()
}
