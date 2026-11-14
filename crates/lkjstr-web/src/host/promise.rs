//! Bounded browser promises. Timeout messages contain no caller-provided data.
use js_sys::{Array, Promise};
use leptos::prelude::set_timeout_with_handle;
use std::time::Duration;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;

pub async fn bounded(
    work: Promise,
    seconds: u64,
    message: &'static str,
    cancel: impl FnOnce() + 'static,
) -> Result<JsValue, JsValue> {
    let mut timer = None;
    let mut cancel = Some(cancel);
    let deadline = Promise::new(&mut |_, reject| {
        let reject = reject.clone();
        let cancel = cancel.take();
        timer = set_timeout_with_handle(
            move || {
                if let Some(cancel) = cancel {
                    cancel();
                }
                let _ = reject.call1(&JsValue::NULL, &message.into());
            },
            Duration::from_secs(seconds),
        )
        .ok();
    });
    let promises = Array::new();
    promises.push(&work);
    promises.push(&deadline);
    let result = JsFuture::from(Promise::race(&promises)).await;
    if let Some(timer) = timer {
        timer.clear();
    }
    result
}
