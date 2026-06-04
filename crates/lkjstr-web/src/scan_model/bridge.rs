use serde::Serialize;
use wasm_bindgen::prelude::JsValue;

use lkjstr_app::{
    plan_feed_scan as app_plan_feed_scan, reduce_scan_observation, scan_model_keys_for_context,
};

use super::codec::{
    context_from_dto, key_to_dto, model_to_dto, observation_from_dto, plan_input_from_dto,
    proposal_to_dto, segment_to_dto,
};
use super::dto::{ContextDto, PlanInputDto, ReduceInputDto};

#[derive(Serialize)]
struct PlanOutputDto {
    initial_span_seconds: u64,
    source: String,
    proposal: super::dto::ProposalDto,
    segments: Vec<super::dto::SegmentDto>,
}

#[derive(Serialize)]
struct ReduceOutputDto {
    next_hint_span_seconds: u64,
    unresolved: bool,
    follow_up_segments: Vec<super::dto::SegmentDto>,
    updated_model: super::dto::ModelDto,
    updated_models: Vec<super::dto::ModelDto>,
    proposal: super::dto::ProposalDto,
}

#[derive(Serialize)]
struct BridgeError {
    code: String,
    message: String,
}

pub fn plan_feed_scan(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<PlanInputDto>(input)?;
    let plan_input = plan_input_from_dto(dto);
    let plan = app_plan_feed_scan(&plan_input);
    to_js(&PlanOutputDto {
        initial_span_seconds: plan.initial_span_seconds,
        source: format!("{:?}", plan.source),
        proposal: proposal_to_dto(&plan.proposal),
        segments: plan.segments.iter().map(segment_to_dto).collect(),
    })
}

pub fn reduce_feed_scan_observation(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<ReduceInputDto>(input)?;
    let plan_input = plan_input_from_dto(dto.plan);
    let observation = observation_from_dto(dto.observation);
    let update = reduce_scan_observation(&plan_input, &observation);
    to_js(&ReduceOutputDto {
        next_hint_span_seconds: update.next_hint.next_span_seconds,
        unresolved: update.unresolved,
        follow_up_segments: update
            .follow_up_segments
            .iter()
            .map(segment_to_dto)
            .collect(),
        updated_model: model_to_dto(&update.updated_model),
        updated_models: update.updated_models.iter().map(model_to_dto).collect(),
        proposal: proposal_to_dto(&update.proposal),
    })
}

pub fn select_scan_model_keys(input: JsValue) -> Result<JsValue, JsValue> {
    let dto = parse::<ContextDto>(input)?;
    let context = context_from_dto(&dto);
    let keys = scan_model_keys_for_context(&context)
        .into_iter()
        .map(|(scope, key)| key_to_dto(&key, &scope))
        .collect::<Vec<_>>();
    to_js(&keys)
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
    serde_wasm_bindgen::to_value(&error).unwrap_or_else(|_| JsValue::from_str("scan bridge error"))
}
