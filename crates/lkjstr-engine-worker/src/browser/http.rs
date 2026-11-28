//! Abortable, streaming, size-bounded HTTP for identity and relay information.
use super::fetch_observation::HttpObservation;
use super::{promise, timer::Timer};
use wasm_bindgen::{JsCast, JsValue};
use web_sys::{
    AbortController, ReadableStreamDefaultReader, Request, RequestInit, RequestRedirect, Response,
};
pub async fn get(
    url: &str,
    accept: &str,
    max: usize,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    request_for(url, accept, max, "GET", (None, None, None), 10_000).await
}
/// Only public caller-selected effects pass an observation; authenticated requests never do.
pub async fn get_observed(
    url: &str,
    accept: &str,
    max: usize,
    mut observation: HttpObservation,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    let result = request_observed(
        url,
        accept,
        max,
        "GET",
        (None, None, None),
        10_000,
        None,
        Some(&mut observation),
    )
    .await;
    let outcome = result.as_ref().err().map(HttpObservation::error);
    observation.complete(outcome);
    result
}
pub async fn request(
    url: &str,
    accept: &str,
    max: usize,
    method: &str,
    body: Option<&JsValue>,
    mime: Option<&str>,
    auth: Option<&str>,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    request_for(url, accept, max, method, (body, mime, auth), 30_000).await
}
pub async fn request_for(
    url: &str,
    accept: &str,
    max: usize,
    method: &str,
    (body, mime, auth): (Option<&JsValue>, Option<&str>, Option<&str>),
    ms: u32,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    request_for_signal(url, accept, max, method, (body, mime, auth), ms, None).await
}
pub async fn request_for_signal(
    url: &str,
    accept: &str,
    max: usize,
    method: &str,
    (body, mime, auth): (Option<&JsValue>, Option<&str>, Option<&str>),
    ms: u32,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    request_observed(
        url,
        accept,
        max,
        method,
        (body, mime, auth),
        ms,
        signal,
        None,
    )
    .await
}
#[allow(clippy::too_many_arguments)]
async fn request_observed(
    url: &str,
    accept: &str,
    max: usize,
    method: &str,
    (body, mime, auth): (Option<&JsValue>, Option<&str>, Option<&str>),
    ms: u32,
    signal: Option<&web_sys::AbortSignal>,
    mut observation: Option<&mut HttpObservation>,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    super::abort::check(signal)?;
    let abort = AbortController::new()?;
    let _parent = signal
        .map(|signal| {
            let abort = abort.clone();
            super::abort::listen(signal, move || abort.abort())
        })
        .transpose()?;
    let options = RequestInit::new();
    options.set_method(method);
    if let Some(body) = body {
        options.set_body(body);
    }
    options.set_signal(Some(&abort.signal()));
    options.set_redirect(RequestRedirect::Error);
    let request = Request::new_with_str_and_init(url, &options)?;
    request.headers().set("Accept", accept)?;
    if let Some(mime) = mime {
        request.headers().set("Content-Type", mime)?;
    }
    if let Some(auth) = auth {
        request.headers().set("Authorization", auth)?;
    }
    let cancel = abort.clone();
    let _timer = Timer::after(ms, move || cancel.abort())?;
    let global = js_sys::global();
    let fetch: js_sys::Function = js_sys::Reflect::get(&global, &"fetch".into())?.dyn_into()?;
    let pending: js_sys::Promise = fetch.call1(&global, &request)?.dyn_into()?;
    let cancel = abort.clone();
    let response: Response =
        promise::bounded_ms_for(pending, ms, "http-timeout", move || cancel.abort(), signal)
            .await?
            .dyn_into()?;
    if let Some(o) = observation.as_deref_mut() {
        o.response(response.status());
    }
    if method == "HEAD" {
        return Ok(lkjstr_nips::identity::HttpResponse {
            status: response.status(),
            final_url: response.url(),
            body: String::new(),
        });
    }
    let reader: ReadableStreamDefaultReader = response
        .body()
        .ok_or_else(|| JsValue::from_str("empty-body"))?
        .get_reader()
        .dyn_into()?;
    let mut bytes = Vec::new();
    loop {
        let chunk = super::abort::race(reader.read(), signal).await?;
        if js_sys::Reflect::get(&chunk, &"done".into())?.as_bool() == Some(true) {
            break;
        }
        let chunk = js_sys::Uint8Array::new(&js_sys::Reflect::get(&chunk, &"value".into())?);
        if let Some(o) = observation.as_deref_mut() {
            o.bytes(u64::from(chunk.length()));
        }
        if bytes.len().saturating_add(chunk.length() as usize) > max {
            abort.abort();
            return Err("body-limit".into());
        }
        bytes.extend(chunk.to_vec());
    }
    Ok(lkjstr_nips::identity::HttpResponse {
        status: response.status(),
        final_url: response.url(),
        body: String::from_utf8(bytes).map_err(|_| JsValue::from_str("invalid-utf8"))?,
    })
}
