#![cfg(target_arch = "wasm32")]

use lkjstr_web::relay_host::{
    RelayHostProblem, RelayHostProblemKind, RelaySocketCallbacks, RelaySocketHandle,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn relay_socket_rejects_invalid_url() -> Result<(), JsValue> {
    match RelaySocketHandle::connect("ws://[", callbacks()) {
        Err(problem) => {
            assert_eq!(problem.kind, RelayHostProblemKind::InvalidUrl);
            assert_eq!(problem.operation, "websocket-open");
            Ok(())
        }
        Ok(mut handle) => {
            let _result = handle.close();
            Err(js_error("invalid websocket url opened"))
        }
    }
}

#[wasm_bindgen_test]
fn relay_socket_close_is_idempotent() -> Result<(), JsValue> {
    let mut handle = relay_result(RelaySocketHandle::connect("ws://127.0.0.1:9", callbacks()))?;
    assert!(handle.ready_state().is_some());

    relay_result(handle.close())?;
    relay_result(handle.close())?;
    assert_eq!(handle.ready_state(), None);
    Ok(())
}

fn callbacks() -> RelaySocketCallbacks {
    RelaySocketCallbacks::new(|| {}, |_message| {}, |_event| {}, |_event| {})
}

fn relay_result<T>(result: Result<T, RelayHostProblem>) -> Result<T, JsValue> {
    result.map_err(|problem| {
        js_error(&format!(
            "{} {:?}: {}",
            problem.operation, problem.kind, problem.reason
        ))
    })
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
