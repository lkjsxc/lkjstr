use lkjstr_protocol::{NostrEvent, NostrTag, UnsignedNostrEvent};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;

pub async fn nip07_public_key() -> Result<String, String> {
    let (nostr, function) = nostr_method("getPublicKey")?;
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

pub async fn nip07_sign_event(event: &UnsignedNostrEvent) -> Result<NostrEvent, String> {
    let (nostr, function) = nostr_method("signEvent")?;
    let value = function
        .call1(&nostr, &unsigned_value(event))
        .map_err(|_| "NIP-07 signer rejected signing.".to_owned())?;
    let result = JsFuture::from(js_sys::Promise::resolve(&value))
        .await
        .map_err(|_| "NIP-07 signer rejected signing.".to_owned())?;
    serde_wasm_bindgen::from_value(result)
        .map_err(|_| "NIP-07 signer returned an invalid event.".to_owned())
}

fn nostr_method(name: &str) -> Result<(JsValue, js_sys::Function), String> {
    let window = web_sys::window().ok_or_else(unavailable)?;
    let nostr =
        js_sys::Reflect::get(&window, &JsValue::from_str("nostr")).map_err(|_| unavailable())?;
    if nostr.is_undefined() || nostr.is_null() {
        return Err(unavailable());
    }
    let method = js_sys::Reflect::get(&nostr, &JsValue::from_str(name)).map_err(|_| unavailable())?;
    let function = method
        .dyn_into::<js_sys::Function>()
        .map_err(|_| unavailable())?;
    Ok((nostr, function))
}

fn unsigned_value(event: &UnsignedNostrEvent) -> JsValue {
    let object = js_sys::Object::new();
    set(&object, "pubkey", JsValue::from_str(&event.pubkey));
    set(&object, "created_at", JsValue::from_f64(event.created_at as f64));
    set(&object, "kind", JsValue::from_f64(event.kind as f64));
    set(&object, "tags", tags_value(&event.tags).into());
    set(&object, "content", JsValue::from_str(&event.content));
    object.into()
}

fn tags_value(tags: &[NostrTag]) -> js_sys::Array {
    tags.iter().fold(js_sys::Array::new(), |array, tag| {
        array.push(&tag_value(tag));
        array
    })
}

fn tag_value(tag: &NostrTag) -> JsValue {
    tag.iter()
        .fold(js_sys::Array::new(), |array, value| {
            array.push(&JsValue::from_str(value));
            array
        })
        .into()
}

fn set(object: &js_sys::Object, key: &str, value: JsValue) {
    let _result = js_sys::Reflect::set(object, &JsValue::from_str(key), &value);
}

fn unavailable() -> String {
    "NIP-07 signer unavailable.".to_owned()
}
