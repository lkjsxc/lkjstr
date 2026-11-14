//! NIP-07 browser extension signer (`window.nostr`).

use js_sys::{Function, Object, Promise, Reflect};
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent, parse_nostr_event_value};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;

const UNAVAILABLE: &str = "No NIP-07 signer extension found in this browser.";

pub fn available() -> bool {
    method("getPublicKey").is_ok()
}

fn method(name: &str) -> Result<(JsValue, Function), String> {
    let window = web_sys::window().ok_or(UNAVAILABLE)?;
    let nostr = Reflect::get(&window, &"nostr".into()).map_err(|_| UNAVAILABLE)?;
    if nostr.is_undefined() || nostr.is_null() {
        return Err(UNAVAILABLE.to_owned());
    }
    let function = Reflect::get(&nostr, &name.into())
        .ok()
        .and_then(|value| value.dyn_into::<Function>().ok())
        .ok_or(UNAVAILABLE)?;
    Ok((nostr, function))
}

async fn call(name: &str, arg: Option<JsValue>) -> Result<JsValue, String> {
    let (nostr, function) = method(name)?;
    let result = match arg {
        Some(arg) => function.call1(&nostr, &arg),
        None => function.call0(&nostr),
    }
    .map_err(|_| "The signer extension refused.".to_owned())?;
    JsFuture::from(Promise::resolve(&result))
        .await
        .map_err(|_| "The signer extension refused.".to_owned())
}

pub async fn public_key() -> Result<String, String> {
    call("getPublicKey", None)
        .await?
        .as_string()
        .filter(|key| lkjstr_protocol::is_pubkey(key))
        .ok_or_else(|| "The signer returned an invalid public key.".to_owned())
}

pub async fn sign(event: &UnsignedNostrEvent) -> Result<NostrEvent, String> {
    let value = serde_json::to_string(event).map_err(|e| e.to_string())?;
    let object: Object = js_sys::JSON::parse(&value)
        .map_err(|_| "Could not encode the event.".to_owned())?
        .unchecked_into();
    let signed = call("signEvent", Some(object.into())).await?;
    let text = js_sys::JSON::stringify(&signed)
        .ok()
        .and_then(|text| text.as_string())
        .ok_or("The signer returned no event.")?;
    let value: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    parse_nostr_event_value(&value, None).map_err(|error| error.message)
}
