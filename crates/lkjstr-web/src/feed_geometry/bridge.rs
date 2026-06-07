use serde::Serialize;
use wasm_bindgen::prelude::JsValue;

use lkjstr_app::{
    capture_feed_anchor, estimate_row_geometry, next_reserved_height, plan_feed_visual_rows,
    reconcile_feed_anchor, update_row_geometry_model,
};

use super::codec::{
    anchor_from_dto, anchor_to_dto, confidence_to_string, estimate_to_dto, features_from_dto,
    fragment_config_from_dto, model_from_dto, model_to_dto, observation_from_dto, row_from_dto,
    semantic_event_from_dto,
};
use super::dto::{
    CaptureAnchorInputDto, EstimateInputDto, PlanFragmentsInputDto, ReconcileAnchorInputDto,
    ReconcileAnchorOutputDto, RecordMeasurementInputDto,
};
use super::reservation_codec::{
    reservation_action_from_dto, reservation_decision_to_dto, row_state_from_dto,
};
use super::reservation_dto::ReservationInputDto;
use super::row_codec::visual_row_to_dto;

#[derive(Serialize)]
struct BridgeError {
    code: String,
    message: String,
}

pub fn estimate_feed_row_height(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<EstimateInputDto>(input)?;
    let features = features_from_dto(dto.features);
    let models = dto
        .models
        .into_iter()
        .map(model_from_dto)
        .collect::<Vec<_>>();
    to_js(&estimate_to_dto(&estimate_row_geometry(
        dto.key, &features, &models,
    )))
}

pub fn record_feed_row_measurement(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<RecordMeasurementInputDto>(input)?;
    let previous = dto.previous.map(model_from_dto);
    let observation = observation_from_dto(dto.observation);
    let model = update_row_geometry_model(previous.as_ref(), &observation);
    to_js(&model_to_dto(&model))
}

pub fn next_feed_row_reservation(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<ReservationInputDto>(input)?;
    let previous = dto.previous.map(row_state_from_dto);
    let action = reservation_action_from_dto(dto.action);
    let decision = next_reserved_height(previous.as_ref(), action);
    to_js(&reservation_decision_to_dto(&decision))
}

pub fn plan_fragments(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<PlanFragmentsInputDto>(input)?;
    let event = semantic_event_from_dto(&dto);
    let config = fragment_config_from_dto(dto.config.clone());
    let rows = plan_feed_visual_rows(
        &event,
        &dto.content_shape_hash,
        dto.estimated_height_px,
        &config,
    );
    to_js(&rows.iter().map(visual_row_to_dto).collect::<Vec<_>>())
}

pub fn capture_anchor(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<CaptureAnchorInputDto>(input)?;
    let rows = dto.rows.into_iter().map(row_from_dto).collect::<Vec<_>>();
    let anchor = capture_feed_anchor(
        &rows,
        dto.scroll_top_px,
        dto.viewport_height_px,
        dto.width_bucket,
        dto.generation,
    );
    to_js(&anchor.as_ref().map(anchor_to_dto))
}

pub fn reconcile_anchor(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<ReconcileAnchorInputDto>(input)?;
    let old_rows = dto
        .old_rows
        .into_iter()
        .map(row_from_dto)
        .collect::<Vec<_>>();
    let new_rows = dto
        .new_rows
        .into_iter()
        .map(row_from_dto)
        .collect::<Vec<_>>();
    let anchor = anchor_from_dto(dto.anchor);
    let result = reconcile_feed_anchor(&old_rows, &new_rows, &anchor);
    to_js(&ReconcileAnchorOutputDto {
        scroll_delta_px: result.scroll_delta_px,
        confidence: confidence_to_string(&result.confidence),
    })
}

fn parse<T>(input: JsValue) -> Result<T, JsValue>
where
    T: for<'de> serde::Deserialize<'de>,
{
    serde_wasm_bindgen::from_value(input).map_err(|error| js_error("bad_input", error.to_string()))
}

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|error| js_error("bad_output", error.to_string()))
}

fn js_error(code: &str, message: String) -> JsValue {
    let error = BridgeError {
        code: code.to_owned(),
        message,
    };
    match serde_wasm_bindgen::to_value(&error) {
        Ok(value) => value,
        Err(_) => JsValue::from_str("feed geometry bridge error"),
    }
}
