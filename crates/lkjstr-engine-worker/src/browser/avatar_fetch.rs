//! Anonymous CORS bytes. Browser HTTP caching is retained; no opaque responses are accepted.
use lkjstr_core::engine::avatars::{MAX_ORIGINAL_BYTES, jobs::Failure};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    AbortController, AbortSignal, Blob, BlobPropertyBag, CacheQueryOptions,
    ReadableStreamDefaultReader, ReferrerPolicy, Request, RequestCredentials, RequestInit,
    RequestMode, Response, ResponseType, WorkerGlobalScope,
};
/// Reuse only a fresh, bounded original that the old public-image SW already copied.
/// This is a read-only migration path on a derived-cache miss, not another cache writer.
async fn legacy_original(url: &str, signal: &AbortSignal) -> Option<Blob> {
    if url.contains(['?', '#']) {
        return None;
    }
    let scope: WorkerGlobalScope = js_sys::global().dyn_into().ok()?;
    let cache = scope.caches().ok()?;
    let options = CacheQueryOptions::new();
    options.set_cache_name("lkjstr-avatar-v1");
    let response: Response = crate::browser::promise::bounded_ms_for(
        cache.match_with_str_and_options(url, &options),
        500,
        "legacy-avatar-lookup",
        || {},
        Some(signal),
    )
    .await
    .ok()?
    .dyn_into()
    .ok()?;
    let expires: f64 = response
        .headers()
        .get("x-lkjstr-avatar-expires")
        .ok()??
        .parse()
        .ok()?;
    let now = js_sys::Date::now();
    if !response.ok() || !expires.is_finite() || expires <= now || expires > now + 3_600_000.0 {
        return None;
    }
    let mime = response.headers().get("content-type").ok()??;
    if !matches!(
        mime.as_str(),
        "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp"
    ) {
        return None;
    }
    let blob: Blob = crate::browser::promise::bounded_ms_for(
        response.blob().ok()?,
        500,
        "legacy-avatar-body",
        || {},
        Some(signal),
    )
    .await
    .ok()?
    .dyn_into()
    .ok()?;
    (blob.type_() == mime && (1.0..=131_072.0).contains(&blob.size())).then_some(blob)
}
pub async fn get(
    url: &str,
    controller: &AbortController,
    observation: &mut crate::browser::fetch_observation::HttpObservation,
) -> Result<Blob, Failure> {
    let fail = |_| Failure::Transient;
    crate::browser::abort::check(Some(&controller.signal())).map_err(fail)?;
    if let Some(blob) = legacy_original(url, &controller.signal()).await {
        observation.cache_hit();
        return Ok(blob);
    }
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
    observation.response(response.status());
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
        observation.bytes(u64::from(chunk.length()));
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
