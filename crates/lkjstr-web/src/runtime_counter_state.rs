use wasm_bindgen::{JsCast, prelude::JsValue};

pub(crate) fn slot(name: &str) -> js_sys::Object {
    let global = js_sys::global();
    object_property(&global, name).unwrap_or_else(|| {
        let object = js_sys::Object::new();
        let _set = js_sys::Reflect::set(&global, &JsValue::from_str(name), &object);
        object
    })
}

#[cfg(target_arch = "wasm32")]
pub(crate) fn child_slot(parent: &js_sys::Object, name: &str) -> js_sys::Object {
    object_property(parent, name).unwrap_or_else(|| {
        let object = js_sys::Object::new();
        let _set = js_sys::Reflect::set(parent, &JsValue::from_str(name), &object);
        object
    })
}

#[cfg(debug_assertions)]
pub(crate) fn clear_slot(name: &str) {
    let global = js_sys::global();
    let _deleted = js_sys::Reflect::delete_property(&global, &JsValue::from_str(name));
}

pub(crate) fn increment_counter(object: &js_sys::Object, key: &str) {
    let count = read_counter(object, key).saturating_add(1);
    let _set = js_sys::Reflect::set(
        object,
        &JsValue::from_str(key),
        &JsValue::from_f64(count as f64),
    );
}

pub(crate) fn read_counter(object: &js_sys::Object, key: &str) -> u64 {
    js_sys::Reflect::get(object, &JsValue::from_str(key))
        .ok()
        .and_then(|value| value.as_f64())
        .filter(|value| value.is_finite() && *value >= 0.0)
        .map(|value| value as u64)
        .unwrap_or(0)
}

fn object_property(parent: &JsValue, name: &str) -> Option<js_sys::Object> {
    let value = js_sys::Reflect::get(parent, &JsValue::from_str(name)).ok()?;
    if value.is_object() && !value.is_null() {
        Some(value.unchecked_into())
    } else {
        None
    }
}
