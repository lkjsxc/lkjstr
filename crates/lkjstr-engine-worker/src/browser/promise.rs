//! Bounded promises use a cancellable worker timer.
use super::timer::Timer;
use js_sys::{Array, Promise};
use wasm_bindgen::JsValue;
pub async fn bounded(
    work: Promise,
    seconds: u64,
    message: &'static str,
    cancel: impl FnOnce() + 'static,
) -> Result<JsValue, JsValue> {
    bounded_ms(
        work,
        seconds.saturating_mul(1000).min(u32::MAX as u64) as u32,
        message,
        cancel,
    )
    .await
}
pub async fn bounded_ms(
    work: Promise,
    ms: u32,
    message: &'static str,
    cancel: impl FnOnce() + 'static,
) -> Result<JsValue, JsValue> {
    bounded_ms_for(work, ms, message, cancel, None).await
}
pub async fn bounded_ms_for(
    work: Promise,
    ms: u32,
    message: &'static str,
    cancel: impl FnOnce() + 'static,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<JsValue, JsValue> {
    let mut timer = None;
    let mut cancel = Some(cancel);
    let deadline = Promise::new(&mut |_, reject| {
        let reject = reject.clone();
        let mut cancel = cancel.take();
        let fail = reject.clone();
        timer = Timer::after(ms, move || {
            if let Some(cancel) = cancel.take() {
                cancel();
            }
            let _ = reject.call1(&JsValue::NULL, &message.into());
        })
        .ok();
        if timer.is_none() {
            let _ = reject_timer_failure(&fail);
        }
    });
    let promises = Array::new();
    promises.push(&work);
    promises.push(&deadline);
    let result = super::abort::race(Promise::race(&promises), signal).await;
    drop(timer);
    result
}
fn reject_timer_failure(reject: &js_sys::Function) -> Result<JsValue, JsValue> {
    reject.call1(&JsValue::NULL, &"timer unavailable".into())
}

/// Cancellable worker delay; the timer is released after settlement.
pub async fn pause(ms: u32) -> Result<(), JsValue> {
    pause_for(ms, None).await
}
pub async fn pause_for(ms: u32, signal: Option<&web_sys::AbortSignal>) -> Result<(), JsValue> {
    super::abort::check(signal)?;
    let mut timer = None;
    let work = Promise::new(&mut |resolve, reject| {
        timer = Timer::after(ms, move || {
            let _ = resolve.call0(&JsValue::NULL);
        })
        .ok();
        if timer.is_none() {
            let _ = reject_timer_failure(&reject);
        }
    });
    let result = super::abort::race(work, signal).await.map(|_| ());
    drop(timer);
    result
}
