//! Anonymous bounded GETs for untrusted public metadata and unpaid zap callbacks.
use super::{abort, promise, timer::Timer};
use wasm_bindgen::{JsCast, JsValue};
use web_sys::{
    AbortController, AbortSignal, ReadableStreamDefaultReader, Request, RequestInit,
    RequestRedirect, Response,
};
pub async fn get(
    url: &str,
    ms: u32,
    signal: &AbortSignal,
) -> Result<lkjstr_nips::identity::HttpResponse, JsValue> {
    abort::check(Some(signal))?;
    let controller = AbortController::new()?;
    let linked = controller.clone();
    let _parent = abort::listen(signal, move || linked.abort())?;
    let options = RequestInit::new();
    options.set_method("GET");
    options.set_signal(Some(&controller.signal()));
    options.set_redirect(RequestRedirect::Error);
    for (key, value) in [
        ("credentials", "omit"),
        ("referrerPolicy", "no-referrer"),
        ("cache", "no-store"),
    ] {
        js_sys::Reflect::set(options.as_ref(), &key.into(), &value.into())?;
    }
    let request = Request::new_with_str_and_init(url, &options)?;
    request.headers().set("Accept", "application/json")?;
    let cancel = controller.clone();
    let _timer = Timer::after(ms, move || cancel.abort())?;
    let global = js_sys::global();
    let fetch: js_sys::Function = js_sys::Reflect::get(&global, &"fetch".into())?.dyn_into()?;
    let pending: js_sys::Promise = fetch.call1(&global, &request)?.dyn_into()?;
    let cancel = controller.clone();
    let response: Response = promise::bounded_ms_for(
        pending,
        ms,
        "http-timeout",
        move || cancel.abort(),
        Some(signal),
    )
    .await?
    .dyn_into()?;
    let reader: ReadableStreamDefaultReader = response
        .body()
        .ok_or_else(|| JsValue::from_str("empty-body"))?
        .get_reader()
        .dyn_into()?;
    let mut bytes = vec![];
    loop {
        // The internal deadline signal also wakes a deliberately stalled body.
        let chunk = abort::race(reader.read(), Some(&controller.signal())).await?;
        if js_sys::Reflect::get(&chunk, &"done".into())?.as_bool() == Some(true) {
            break;
        }
        let chunk = js_sys::Uint8Array::new(&js_sys::Reflect::get(&chunk, &"value".into())?);
        if bytes.len().saturating_add(chunk.length() as usize)
            > lkjstr_core::engine::zaps::MAX_RESPONSE_BYTES
        {
            controller.abort();
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
