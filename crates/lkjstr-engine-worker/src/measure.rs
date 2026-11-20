//! Monotonic browser timing, usable in workers.
use wasm_bindgen::JsCast;
fn performance() -> Option<web_sys::Performance> {
    js_sys::Reflect::get(&js_sys::global(), &"performance".into())
        .ok()?
        .dyn_into()
        .ok()
}
pub(crate) fn now() -> f64 {
    performance().map_or_else(js_sys::Date::now, |p| p.now())
}
pub(crate) fn origin() -> f64 {
    performance().map_or(0.0, |p| p.time_origin())
}
#[cfg(feature = "harness")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn benchmark() -> wasm_bindgen::JsValue {
    let result = lkjstr_core::engine::bench::run(now);
    serde_json::to_string(&result)
        .ok()
        .and_then(|s| js_sys::JSON::parse(&s).ok())
        .unwrap_or(wasm_bindgen::JsValue::NULL)
}
