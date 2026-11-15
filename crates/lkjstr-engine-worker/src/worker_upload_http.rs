//! Upload transport; no implicit redirect, unbounded poll or unbounded response.
use super::clock;
use lkjstr_core::engine::upload::Deadline;
use lkjstr_nips::identity::HttpResponse;
use wasm_bindgen::JsValue;
fn failure(error: JsValue) -> &'static str {
    match error.as_string().as_deref() {
        Some("http-timeout" | "upload-timeout") => "upload-timeout",
        Some("body-limit" | "invalid-utf8" | "empty-body") => "upload-response",
        _ if js_sys::Reflect::get(&error, &"name".into())
            .ok()
            .and_then(|v| v.as_string())
            .as_deref()
            == Some("AbortError") =>
        {
            "upload-timeout"
        }
        _ => "upload-network",
    }
}
pub(super) fn status(status: u16) -> Result<(), &'static str> {
    match status {
        200..=202 => Ok(()),
        402 => Err("upload-payment"),
        413 => Err("too-large"),
        401 | 403 => Err("rejected"),
        _ => Err("upload-response"),
    }
}
pub(super) async fn discover(server: &str, deadline: Deadline) -> Result<String, &'static str> {
    let mut server = server.to_owned();
    // NIP-96 permits delegation; cap the chain at two documents.
    for _ in 0..2 {
        let url = lkjstr_protocol::nip96_discovery_url(&server).ok_or("upload-discovery")?;
        let response = get(&url, deadline).await.map_err(failure)?;
        if response.status != 200 {
            return Err("upload-discovery");
        }
        let value = serde_json::from_str(&response.body).map_err(|_| "upload-discovery")?;
        let parsed = lkjstr_protocol::parse_nip96_server_value(&value).ok_or("upload-discovery")?;
        if let Some(url) = parsed
            .api_url
            .filter(|u| lkjstr_core::engine::settings::valid_server(u))
        {
            return Ok(url);
        }
        server = parsed
            .delegated_to_url
            .filter(|u| lkjstr_core::engine::settings::valid_server(u))
            .ok_or("upload-discovery")?;
    }
    Err("upload-discovery")
}
pub(super) async fn send(
    endpoint: &str,
    auth: &str,
    name: &str,
    mime: &str,
    bytes: &[u8],
    blossom: bool,
    deadline: Deadline,
) -> Result<HttpResponse, &'static str> {
    let data = js_sys::Uint8Array::from(bytes);
    let body: JsValue = if blossom {
        data.into()
    } else {
        let parts = js_sys::Array::new();
        parts.push(&data);
        let options = web_sys::BlobPropertyBag::new();
        options.set_type(mime);
        let blob = web_sys::Blob::new_with_u8_array_sequence_and_options(&parts, &options)
            .map_err(|_| "internal")?;
        let form = web_sys::FormData::new().map_err(|_| "internal")?;
        form.append_with_blob_and_filename("file", &blob, name)
            .map_err(|_| "internal")?;
        form.into()
    };
    crate::browser::http::request_for(
        endpoint,
        "application/json",
        65536,
        lkjstr_protocol::upload::method(blossom),
        (
            Some(&body),
            if blossom { Some(mime) } else { None },
            Some(auth),
        ),
        deadline.wait(clock(), 30_000)?,
    )
    .await
    .map_err(failure)
}
pub(super) async fn processed(body: &str, deadline: Deadline) -> Result<String, &'static str> {
    // A 202 may already contain usable final metadata (NIP-96 delayed processing).
    let value: serde_json::Value = serde_json::from_str(body).map_err(|_| "upload-response")?;
    if value["status"] == "success" && value["nip94_event"].is_object() {
        return Ok(body.into());
    }
    let url = value["processing_url"]
        .as_str()
        .filter(|u| lkjstr_core::engine::settings::valid_server(u))
        .ok_or("upload-response")?;
    for _ in 0..6 {
        crate::browser::promise::pause(deadline.wait(clock(), 1000)?)
            .await
            .map_err(|_| "internal")?;
        let response = get(url, deadline).await.map_err(failure)?;
        status(response.status)?;
        let value: serde_json::Value =
            serde_json::from_str(&response.body).map_err(|_| "upload-response")?;
        if value["status"] == "success" {
            return Ok(response.body);
        }
        if value["status"] != "processing" {
            return Err("upload-response");
        }
    }
    Err("upload-timeout")
}

async fn get(url: &str, deadline: Deadline) -> Result<HttpResponse, JsValue> {
    let ms = deadline.wait(clock(), 30_000).map_err(JsValue::from_str)?;
    crate::browser::http::request_for(
        url,
        "application/json",
        65536,
        "GET",
        (None, None, None),
        ms,
    )
    .await
}
