#![cfg(target_arch = "wasm32")]

use lkjstr_app::GeometryEstimateSource;
use lkjstr_web::custom_request_geometry_test_api::custom_request_geometry_probe;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn custom_request_relay_snapshot_uses_geometry_model() -> Result<(), JsValue> {
    let probe = custom_request_geometry_probe().ok_or_else(|| js_error("missing probe"))?;

    assert_eq!(probe.estimated_height_px, 577);
    assert_eq!(probe.source, GeometryEstimateSource::ExactKey);
    Ok(())
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
