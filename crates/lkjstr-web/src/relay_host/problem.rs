use wasm_bindgen::prelude::JsValue;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayHostProblemKind {
    Unavailable,
    InvalidUrl,
    SendFailed,
    Canceled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayHostProblem {
    pub kind: RelayHostProblemKind,
    pub operation: &'static str,
    pub reason: String,
}

pub type RelayHostResult<T> = Result<T, RelayHostProblem>;

impl RelayHostProblem {
    pub fn new(
        kind: RelayHostProblemKind,
        operation: &'static str,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            kind,
            operation,
            reason: reason.into(),
        }
    }

    pub(super) fn js(kind: RelayHostProblemKind, operation: &'static str, value: JsValue) -> Self {
        Self::new(kind, operation, js_reason(value))
    }
}

fn js_reason(value: JsValue) -> String {
    if let Some(text) = value.as_string() {
        return text;
    }
    match js_sys::Reflect::get(&value, &JsValue::from_str("message"))
        .ok()
        .and_then(|message| message.as_string())
    {
        Some(message) => message,
        None => "javascript-error".to_owned(),
    }
}
