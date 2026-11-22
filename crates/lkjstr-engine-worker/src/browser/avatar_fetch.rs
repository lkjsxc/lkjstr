//! Anonymous CORS bytes. Browser HTTP caching is retained; no opaque responses are accepted.
use lkjstr_core::engine::avatars::{MAX_ORIGINAL_BYTES, jobs::Failure};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    AbortController, Blob, BlobPropertyBag, ReadableStreamDefaultReader, ReferrerPolicy, Request,
    RequestCredentials, RequestInit, RequestMode, Response, ResponseType,
};
pub async fn get(url: &str, controller: &AbortController) -> Result<Blob, Failure> {
    let fail = |_| Failure::Transient;
    crate::browser::abort::check(Some(&controller.signal())).map_err(fail)?;
    let options = RequestInit::new();
    options.set_method("GET");
    options.set_signal(Some(&controller.signal()));
    options.set_mode(RequestMode::Cors);
    options.set_credentials(RequestCredentials::Omit);
    options.set_referrer_policy(ReferrerPolicy::NoReferrer);
    let request = Request::new_with_str_and_init(url, &options).map_err(fail)?;
    request.headers().set("Accept", "image/*").map_err(fail)?;
    let global = js_sys::global();
    let fetch: js_sys::Function = js_sys::Reflect::get(&global, &"fetch".into())
        .map_err(fail)?
        .dyn_into()
        .map_err(fail)?;
    let pending: js_sys::Promise = fetch
        .call1(&global, &request)
        .map_err(fail)?
        .dyn_into()
        .map_err(fail)?;
    // The native deadline aborts this controller. Await real settlement before returning its permit.
    let response: Response = JsFuture::from(pending)
        .await
        .map_err(fail)?
        .dyn_into()
        .map_err(fail)?;
    if !response.ok()
        || !matches!(response.type_(), ResponseType::Basic | ResponseType::Cors)
        || !response.url().starts_with("https://")
    {
        controller.abort();
        return Err(Failure::Transient);
    }
    if response
        .headers()
        .get("content-length")
        .map_err(fail)?
        .and_then(|s| s.parse::<u64>().ok())
        .is_some_and(|bytes| bytes > MAX_ORIGINAL_BYTES)
    {
        controller.abort();
        return Err(Failure::Unsupported { uniform: false });
    }
    let reader: ReadableStreamDefaultReader = response
        .body()
        .ok_or(Failure::Transient)?
        .get_reader()
        .dyn_into()
        .map_err(|_| Failure::Transient)?;
    let mut bytes = Vec::new();
    loop {
        let chunk = JsFuture::from(reader.read()).await.map_err(fail)?;
        if controller.signal().aborted() {
            return Err(Failure::Transient);
        }
        if js_sys::Reflect::get(&chunk, &"done".into())
            .map_err(fail)?
            .as_bool()
            == Some(true)
        {
            break;
        }
        let chunk =
            js_sys::Uint8Array::new(&js_sys::Reflect::get(&chunk, &"value".into()).map_err(fail)?);
        if bytes.len().saturating_add(chunk.length() as usize) > MAX_ORIGINAL_BYTES as usize {
            controller.abort();
            return Err(Failure::Unsupported { uniform: false });
        }
        bytes.extend(chunk.to_vec());
    }
    reader.release_lock();
    if bytes.is_empty() {
        return Err(Failure::Unsupported { uniform: false });
    }
    let content_type = response
        .headers()
        .get("content-type")
        .map_err(fail)?
        .unwrap_or_default();
    let options = BlobPropertyBag::new();
    options.set_type(content_type.split(';').next().unwrap_or_default());
    let parts = js_sys::Array::new();
    parts.push(&js_sys::Uint8Array::from(bytes.as_slice()));
    Blob::new_with_u8_array_sequence_and_options(&parts, &options)
        .map_err(|_: JsValue| Failure::Unsupported { uniform: false })
}
