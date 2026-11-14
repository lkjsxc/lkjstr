//! Abortable, streaming, size-bounded HTTP for identity and relay information.
use super::{promise, timer::Timer};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    AbortController, ReadableStreamDefaultReader, Request, RequestInit, RequestRedirect, Response,
};
pub async fn get(
    url: &str,
    accept: &str,
    max: usize,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    request(url, accept, max, "GET", None, None, None).await
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
    let abort = AbortController::new()?;
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
    let _timer = Timer::after(10000, move || cancel.abort())?;
    let global = js_sys::global();
    let fetch: js_sys::Function = js_sys::Reflect::get(&global, &"fetch".into())?.dyn_into()?;
    let pending: js_sys::Promise = fetch.call1(&global, &request)?.dyn_into()?;
    let cancel = abort.clone();
    let response: Response = promise::bounded(pending, 10, "http-timeout", move || cancel.abort())
        .await?
        .dyn_into()?;
    let reader: ReadableStreamDefaultReader = response
        .body()
        .ok_or_else(|| JsValue::from_str("empty-body"))?
        .get_reader()
        .dyn_into()?;
    let mut bytes = Vec::new();
    loop {
        let chunk = JsFuture::from(reader.read()).await?;
        if js_sys::Reflect::get(&chunk, &"done".into())?.as_bool() == Some(true) {
            break;
        }
        let chunk = js_sys::Uint8Array::new(&js_sys::Reflect::get(&chunk, &"value".into())?);
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
