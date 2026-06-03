#![doc = "Serializable scan density bridge."]

mod bridge;
mod codec;
mod codec_helpers;
mod dto;

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

#[wasm_bindgen]
pub fn plan_feed_scan_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::plan_feed_scan(input)
}

#[wasm_bindgen]
pub fn reduce_feed_scan_observation_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::reduce_feed_scan_observation(input)
}

#[wasm_bindgen]
pub fn select_scan_model_keys_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::select_scan_model_keys(input)
}

#[cfg(test)]
mod tests {
    use super::codec_helpers::direction_from_dto;
    use super::dto::ScanDirectionDto;

    #[test]
    fn codec_accepts_older_direction() {
        let direction = direction_from_dto(&ScanDirectionDto::Older);
        assert!(matches!(direction, lkjstr_app::ScanDirection::Older));
    }
}
