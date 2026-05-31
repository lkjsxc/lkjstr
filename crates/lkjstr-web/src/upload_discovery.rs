use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;

use lkjstr_protocol::{nip96_discovery_url, parse_nip96_server_value, valid_https_url};

pub async fn resolve_upload_endpoint(server: &str) -> Result<String, String> {
    let direct = valid_https_url(server.trim())
        .ok_or_else(|| "Media upload server must be HTTPS.".to_owned())?;
    let mut current = direct.as_str().to_owned();
    let mut seen = Vec::<String>::new();
    for _ in 0..8 {
        let Some(url) = valid_https_url(&current) else {
            return Err("Media upload server must be HTTPS.".to_owned());
        };
        let origin = url.origin().ascii_serialization();
        if seen.contains(&origin) {
            return Ok(url.as_str().to_owned());
        }
        seen.push(origin);
        let Some(discovery_url) = nip96_discovery_url(url.as_str()) else {
            return Ok(url.as_str().to_owned());
        };
        let Some(document) = fetch_json(&discovery_url).await? else {
            return Ok(url.as_str().to_owned());
        };
        let Some(server) = parse_nip96_server_value(&document) else {
            return Ok(url.as_str().to_owned());
        };
        if let Some(api) = server.api_url.and_then(|value| valid_https_url(&value)) {
            return Ok(api.as_str().to_owned());
        }
        if let Some(delegated) = server
            .delegated_to_url
            .and_then(|value| valid_https_url(&value))
        {
            current = delegated.as_str().to_owned();
            continue;
        }
        return Ok(url.as_str().to_owned());
    }
    Ok(current)
}

async fn fetch_json(url: &str) -> Result<Option<serde_json::Value>, String> {
    let window = web_sys::window().ok_or_else(|| "Browser window unavailable.".to_owned())?;
    let fetch = js_sys::Reflect::get(window.as_ref(), &JsValue::from_str("fetch"))
        .map_err(|_| "Browser fetch unavailable.".to_owned())?
        .dyn_into::<js_sys::Function>()
        .map_err(|_| "Browser fetch unavailable.".to_owned())?;
    let promise = fetch
        .call1(window.as_ref(), &JsValue::from_str(url))
        .map_err(|_| "Discovery request failed.".to_owned())?
        .dyn_into::<js_sys::Promise>()
        .map_err(|_| "Discovery request did not return a promise.".to_owned())?;
    let response = JsFuture::from(promise)
        .await
        .map_err(|_| "Discovery request failed.".to_owned())?;
    let response = response
        .dyn_into::<web_sys::Response>()
        .map_err(|_| "Discovery response was not a Response.".to_owned())?;
    if !response.ok() {
        return Ok(None);
    }
    let json = response
        .json()
        .map_err(|_| "Discovery response could not be read.".to_owned())?;
    let value = JsFuture::from(json)
        .await
        .map_err(|_| "Discovery response was not JSON.".to_owned())?;
    serde_wasm_bindgen::from_value(value)
        .map(Some)
        .map_err(|error| error.to_string())
}
