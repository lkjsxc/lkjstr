//! Monotonic browser timing, usable in workers.
use wasm_bindgen::JsCast;
pub(crate) fn now() -> f64 {
    let global = js_sys::global();
    let sample = || {
        let performance = js_sys::Reflect::get(&global, &"performance".into()).ok()?;
        let now = js_sys::Reflect::get(&performance, &"now".into())
            .ok()?
            .dyn_into::<js_sys::Function>()
            .ok()?;
        now.call0(&performance).ok()?.as_f64()
    };
    sample().unwrap_or_else(js_sys::Date::now)
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
