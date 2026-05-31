use serde::Serialize;
use wasm_bindgen::prelude::JsValue;

#[derive(Serialize)]
struct OkResponse<T>
where
    T: Serialize,
{
    ok: bool,
    data: T,
}

#[derive(Serialize)]
struct ErrorResponse {
    ok: bool,
    code: &'static str,
    message: String,
}

pub fn ok<T>(data: T) -> JsValue
where
    T: Serialize,
{
    to_js(&OkResponse { ok: true, data })
}

pub fn error(code: &'static str, message: impl Into<String>) -> JsValue {
    to_js(&ErrorResponse {
        ok: false,
        code,
        message: message.into(),
    })
}

fn to_js<T>(value: &T) -> JsValue
where
    T: Serialize,
{
    match serde_wasm_bindgen::to_value(value) {
        Ok(value) => value,
        Err(error) => JsValue::from_str(&format!("bridge serialization failed: {error}")),
    }
}
