#![doc = "WASM bridge for feed geometry, fragments, and anchors."]

mod bridge;
mod codec;
mod dto;
mod row_codec;

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

#[wasm_bindgen]
pub fn estimate_feed_row_height_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::estimate_feed_row_height(input)
}

#[wasm_bindgen]
pub fn record_feed_row_measurement_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::record_feed_row_measurement(input)
}

#[wasm_bindgen]
pub fn plan_feed_visual_rows_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::plan_fragments(input)
}

#[wasm_bindgen]
pub fn capture_feed_anchor_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::capture_anchor(input)
}

#[wasm_bindgen]
pub fn reconcile_feed_anchor_from_js(input: JsValue) -> Result<JsValue, JsValue> {
    bridge::reconcile_anchor(input)
}

#[cfg(test)]
mod tests {
    use super::codec::{features_from_dto, fragment_config_from_dto};
    use super::dto::FeaturesDto;
    use super::row_codec::visual_row_to_dto;
    use lkjstr_app::feed_fragments::EventTextSegmentRow;
    use lkjstr_app::{FeedVisualRow, RowKind};

    #[test]
    fn default_fragment_config_is_available() {
        let config = fragment_config_from_dto(None);
        assert!(config.text_segment_target_chars > 0);
    }

    #[test]
    fn features_codec_accepts_text_segment_kind() {
        let features = features_from_dto(features_dto("event-text-segment"));

        assert!(matches!(features.row_kind, RowKind::EventTextSegment));
        assert_eq!(features.content_shape_hash, "shape");
    }

    #[test]
    fn visual_row_codec_preserves_segment_text() {
        let row = FeedVisualRow::EventTextSegment(EventTextSegmentRow {
            event_id: "a".repeat(64),
            row_key: "row".to_owned(),
            segment_index: 2,
            text: "hello".to_owned(),
            starts_at: 4,
            ends_at: 9,
            relay_provenance: vec!["wss://relay.example".to_owned()],
        });
        let dto = visual_row_to_dto(&row);

        assert_eq!(dto.kind, "event-text-segment");
        assert_eq!(dto.text.as_deref(), Some("hello"));
        assert_eq!(dto.starts_at, Some(4));
    }

    fn features_dto(row_kind: &str) -> FeaturesDto {
        FeaturesDto {
            row_kind: row_kind.to_owned(),
            event_kind: Some(1),
            content_length: 5,
            unicode_scalar_count: 5,
            line_break_count: 0,
            longest_unbroken_token_length: 5,
            url_count: 0,
            media_count: 0,
            reference_preview_count: 0,
            custom_emoji_count: 0,
            has_content_warning: false,
            has_profile_summary: false,
            has_notification_chrome: false,
            has_action_bar: true,
            width_bucket: 3,
            font_scale_bucket: 1,
            content_shape_hash: "shape".to_owned(),
            materialization_tier: "structural".to_owned(),
        }
    }
}
