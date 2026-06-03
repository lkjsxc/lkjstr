#![cfg(target_arch = "wasm32")]

use serde_json::Value;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::relay_score::{relay_read_score_initial_json, relay_read_score_update_json};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn relay_score_bridge_updates_real_score() -> Result<(), JsValue> {
    let key = serde_json::json!({
        "relayUrl": "relay.example",
        "surface": "home",
        "phase": "page",
        "direction": "older",
        "routeGroupKey": "selected",
        "filterShape": "[{\"limit\":20,\"kinds\":[1]}]",
        "purpose": "feed"
    });
    let initial = data(relay_read_score_initial_json(&key.to_string(), 1))?;
    let observation = serde_json::json!({
        "startedAtMs": 1,
        "firstEventMs": 2,
        "eoseMs": 3,
        "durationMs": 2,
        "eventCount": 2,
        "uniqueEventCount": 2,
        "finalCount": 2,
        "timeout": false,
        "closed": false,
        "auth": false,
        "socketError": false,
        "eventLimitReached": false,
        "bytesSent": 1,
        "bytesReceived": 2,
        "updatedAtMs": 4
    });
    let updated = data(relay_read_score_update_json(
        &initial.to_string(),
        &observation.to_string(),
    ))?;

    assert!(score(&updated) > score(&initial));
    Ok(())
}

fn data(value: JsValue) -> Result<Value, JsValue> {
    let value: Value = serde_wasm_bindgen::from_value(value).map_err(js_error)?;
    value
        .get("data")
        .cloned()
        .ok_or_else(|| JsValue::from_str("missing data"))
}

fn score(value: &Value) -> f64 {
    value.get("score").and_then(Value::as_f64).unwrap_or(0.0)
}

fn js_error(error: serde_wasm_bindgen::Error) -> JsValue {
    JsValue::from_str(&error.to_string())
}
