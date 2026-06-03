#![doc = "Serializable relay score bridge."]

mod bridge;
mod codec;

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

#[wasm_bindgen]
pub fn relay_read_score_initial_json(key_json: &str, updated_at_ms: u64) -> JsValue {
    bridge::initial_score_json(key_json, updated_at_ms)
}

#[wasm_bindgen]
pub fn relay_read_score_update_json(score_json: &str, observation_json: &str) -> JsValue {
    bridge::update_score_json(score_json, observation_json)
}

#[wasm_bindgen]
pub fn relay_read_score_order_json(scores_json: &str, now_ms: u64) -> JsValue {
    bridge::order_scores_json(scores_json, now_ms)
}

#[wasm_bindgen]
pub fn relay_read_score_normalize_filter_shape(raw: &str) -> JsValue {
    bridge::normalize_filter_shape_json(raw)
}

#[cfg(test)]
mod tests {
    use super::codec::{RelayReadScoreKeyDto, key_from_dto};

    #[test]
    fn bridge_key_codec_normalizes_filter_shape() {
        let dto = RelayReadScoreKeyDto {
            relay_url: "relay.example".to_owned(),
            surface: "home".to_owned(),
            phase: "page".to_owned(),
            direction: "older".to_owned(),
            route_group_key: "selected".to_owned(),
            filter_shape: r#"[{"limit":20,"kinds":[1]}]"#.to_owned(),
            purpose: "feed".to_owned(),
        };
        let key = key_from_dto(dto);

        assert!(matches!(key, Some(key) if key.relay_url == "wss://relay.example/"));
    }
}
