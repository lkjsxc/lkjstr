#![cfg(target_arch = "wasm32")]

use std::cell::Cell;
use std::rc::Rc;

use lkjstr_web::relay_host::{BrowserTimeout, RelayHostProblem};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn browser_timeout_runs_once_and_marks_inactive() -> Result<(), JsValue> {
    let hits = Rc::new(Cell::new(0_u32));
    let hits_for_timer = hits.clone();
    let timer = relay_result(BrowserTimeout::schedule(5, move || {
        hits_for_timer.set(hits_for_timer.get().saturating_add(1));
    }))?;

    assert!(timer.active());
    delay_ms(30).await?;
    assert_eq!(hits.get(), 1);
    assert!(!timer.active());
    timer.clear();
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn browser_timeout_clear_is_idempotent() -> Result<(), JsValue> {
    let hits = Rc::new(Cell::new(0_u32));
    let hits_for_timer = hits.clone();
    let timer = relay_result(BrowserTimeout::schedule(20, move || {
        hits_for_timer.set(hits_for_timer.get().saturating_add(1));
    }))?;

    timer.clear();
    timer.clear();
    assert!(!timer.active());
    delay_ms(50).await?;
    assert_eq!(hits.get(), 0);
    Ok(())
}

fn relay_result<T>(result: Result<T, RelayHostProblem>) -> Result<T, JsValue> {
    result.map_err(|problem| {
        js_error(&format!(
            "{} {:?}: {}",
            problem.operation, problem.kind, problem.reason
        ))
    })
}

async fn delay_ms(ms: i32) -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let Some(window) = web_sys::window() else {
            let _result = reject.call1(&JsValue::NULL, &js_error("missing window"));
            return;
        };
        let callback = Closure::once_into_js(move || {
            let _result = resolve.call0(&JsValue::NULL);
        });
        let _result = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), ms);
    });
    JsFuture::from(promise).await.map(|_value| ())
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
