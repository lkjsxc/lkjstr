#![doc = "Serializable relay score bridge."]

mod bridge;
mod codec;

pub use bridge::{
    initial_score_json, normalize_filter_shape_json, order_scores_json, update_score_json,
};

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
