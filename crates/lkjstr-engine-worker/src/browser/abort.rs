//! Owned abort listeners. Callbacks must not borrow the already-borrowed Host.
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use wasm_bindgen_futures::JsFuture;
use web_sys::AbortSignal;
pub const CANCELLED: &str = "upload-cancelled";
pub fn check(signal: Option<&AbortSignal>) -> Result<(), JsValue> {
    if signal.is_some_and(AbortSignal::aborted) {
        Err(CANCELLED.into())
    } else {
        Ok(())
    }
}
pub struct Guard {
    signal: AbortSignal,
    listener: Option<Closure<dyn FnMut()>>,
}
impl Drop for Guard {
    fn drop(&mut self) {
        if let Some(listener) = &self.listener {
            let _ = self
                .signal
                .remove_event_listener_with_callback("abort", listener.as_ref().unchecked_ref());
        }
    }
}
pub fn listen(signal: &AbortSignal, run: impl FnOnce() + 'static) -> Result<Guard, JsValue> {
    if signal.aborted() {
        run();
        return Ok(Guard {
            signal: signal.clone(),
            listener: None,
        });
    }
    let mut run = Some(run);
    let listener = Closure::new(move || {
        if let Some(run) = run.take() {
            run();
        }
    });
    signal.add_event_listener_with_callback("abort", listener.as_ref().unchecked_ref())?;
    Ok(Guard {
        signal: signal.clone(),
        listener: Some(listener),
    })
}
/// Wake the awaiting owner so its maps, timers and effect handles are cleaned up.
/// The owner must separately abort an effect whose promise does not cancel itself.
pub async fn race(work: js_sys::Promise, signal: Option<&AbortSignal>) -> Result<JsValue, JsValue> {
    let Some(signal) = signal else {
        return JsFuture::from(work).await;
    };
    let mut guard = None;
    let stopped = js_sys::Promise::new(&mut |_, reject| {
        let reject_later = reject.clone();
        match listen(signal, move || {
            let _ = reject_later.call1(&JsValue::NULL, &CANCELLED.into());
        }) {
            Ok(listener) => guard = Some(listener),
            Err(error) => {
                let _ = reject.call1(&JsValue::NULL, &error);
            }
        }
    });
    let pending = js_sys::Array::new();
    pending.push(&stopped);
    pending.push(&work);
    let result = JsFuture::from(js_sys::Promise::race(&pending)).await;
    drop(guard);
    result
}
