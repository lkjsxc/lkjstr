#![doc = "Cache Storage inventory rows."]

use js_sys::{Array, Function, Promise, Reflect};
use lkjstr_storage::StorageInventoryRow;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;

const DEADLINE_MS: f64 = 500.0;

pub async fn cache_storage_rows() -> Vec<StorageInventoryRow> {
    vec![cache_storage_row().await]
}

async fn cache_storage_row() -> StorageInventoryRow {
    let Some(window) = web_sys::window() else {
        return unavailable_row("missing-window");
    };
    let Ok(caches) = Reflect::get(window.as_ref(), &JsValue::from_str("caches")) else {
        return unavailable_row("cache-storage-unavailable");
    };
    if caches.is_null() || caches.is_undefined() {
        return status_row("unsupported", None, None, Some("cache-storage-unsupported"));
    }
    let started_at = js_sys::Date::now();
    let names = match call_array_method(&caches, "keys").await {
        Ok(names) => names,
        Err(reason) => return unavailable_row(reason),
    };
    let mut request_count = 0;
    let mut estimated_bytes = 0;
    for name in names.iter().filter_map(|item| item.as_string()) {
        if let Some(row) = deadline_row(started_at, request_count, estimated_bytes) {
            return row;
        }
        let name_value = JsValue::from_str(&name);
        let cache = match call_value_method_with_arg(&caches, "open", &name_value).await {
            Ok(cache) => cache,
            Err(reason) => return unavailable_row(reason),
        };
        let requests = match call_array_method(&cache, "keys").await {
            Ok(requests) => requests,
            Err(reason) => return unavailable_row(reason),
        };
        for request in requests.iter() {
            if let Some(row) = deadline_row(started_at, request_count, estimated_bytes) {
                return row;
            }
            request_count = request_count.saturating_add(1);
            let response = match call_value_method_with_arg(&cache, "match", &request).await {
                Ok(response) => response,
                Err(reason) => return unavailable_row(reason),
            };
            estimated_bytes = estimated_bytes.saturating_add(match response_bytes(&response).await {
                Ok(bytes) => bytes,
                Err(reason) => return unavailable_row(reason),
            });
        }
    }
    deadline_row(started_at, request_count, estimated_bytes)
        .unwrap_or_else(|| status_row("exact", Some(request_count), Some(estimated_bytes), None))
}

async fn call_array_method(
    receiver: &JsValue,
    method: &'static str,
) -> Result<Array, &'static str> {
    let value = call_value_method(receiver, method).await?;
    if Array::is_array(&value) {
        Ok(Array::from(&value))
    } else {
        Err("cache-storage-malformed")
    }
}

async fn call_value_method(
    receiver: &JsValue,
    method: &'static str,
) -> Result<JsValue, &'static str> {
    let function = method_function(receiver, method)?;
    let promise = function
        .call0(receiver)
        .and_then(|value| value.dyn_into::<Promise>())
        .map_err(|_| "cache-storage-call-failed")?;
    JsFuture::from(promise)
        .await
        .map_err(|_| "cache-storage-call-failed")
}

async fn call_value_method_with_arg(
    receiver: &JsValue,
    method: &'static str,
    arg: &JsValue,
) -> Result<JsValue, &'static str> {
    let function = method_function(receiver, method)?;
    let promise = function
        .call1(receiver, arg)
        .and_then(|value| value.dyn_into::<Promise>())
        .map_err(|_| "cache-storage-call-failed")?;
    JsFuture::from(promise)
        .await
        .map_err(|_| "cache-storage-call-failed")
}

fn method_function(receiver: &JsValue, method: &'static str) -> Result<Function, &'static str> {
    Reflect::get(receiver, &JsValue::from_str(method))
        .map_err(|_| "cache-storage-method-unavailable")?
        .dyn_into::<Function>()
        .map_err(|_| "cache-storage-method-unavailable")
}

async fn response_bytes(response: &JsValue) -> Result<u64, &'static str> {
    if response.is_null() || response.is_undefined() {
        return Ok(0);
    }
    let blob = call_value_method(response, "blob").await?;
    Reflect::get(&blob, &JsValue::from_str("size"))
        .map_err(|_| "cache-storage-malformed")?
        .as_f64()
        .filter(|value| value.is_finite() && *value >= 0.0)
        .map(|value| value.min(u64::MAX as f64) as u64)
        .ok_or("cache-storage-malformed")
}

fn deadline_row(
    started_at: f64,
    request_count: u64,
    estimated_bytes: u64,
) -> Option<StorageInventoryRow> {
    let elapsed = js_sys::Date::now() - started_at;
    if elapsed <= DEADLINE_MS {
        return None;
    }
    let status = if request_count > 0 {
        "partial"
    } else {
        "timeout"
    };
    Some(status_row(
        status,
        Some(request_count),
        Some(estimated_bytes),
        Some("cache scan deadline reached"),
    ))
}

fn unavailable_row(reason: &str) -> StorageInventoryRow {
    status_row("unavailable", None, None, Some(reason))
}

fn status_row(
    status: &str,
    row_count: Option<u64>,
    estimated_bytes: Option<u64>,
    reason: Option<&str>,
) -> StorageInventoryRow {
    StorageInventoryRow {
        table: "Cache Storage".to_string(),
        data_class: "non-indexed-browser-storage".to_string(),
        group: "non-indexed".to_string(),
        status: status.to_string(),
        row_count,
        estimated_bytes,
        problem_reason: reason.map(str::to_string),
    }
}
