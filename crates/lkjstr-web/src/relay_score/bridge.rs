use wasm_bindgen::prelude::JsValue;

use crate::response;
use lkjstr_relays::{
    RelayReadScore, normalize_filter_shape, order_relay_read_scores, update_relay_read_score,
};

use super::codec::{
    RelayReadObservationDto, RelayReadScoreDto, RelayReadScoreKeyDto, key_from_dto,
    observation_from_dto, score_from_dto, score_to_dto,
};

pub fn initial_score_json(key_json: &str, updated_at_ms: u64) -> JsValue {
    let dto = match serde_json::from_str::<RelayReadScoreKeyDto>(key_json) {
        Ok(dto) => dto,
        Err(error) => return response::error("bad_json", error.to_string()),
    };
    let Some(key) = key_from_dto(dto) else {
        return response::error("bad_key", "relay score key is invalid");
    };
    response::ok(score_to_dto(&RelayReadScore::neutral(key, updated_at_ms)))
}

pub fn update_score_json(score_json: &str, observation_json: &str) -> JsValue {
    let previous = match parse_score(score_json) {
        Ok(score) => score,
        Err(value) => return value,
    };
    let observation = match serde_json::from_str::<RelayReadObservationDto>(observation_json) {
        Ok(dto) => observation_from_dto(dto, previous.key.clone()),
        Err(error) => return response::error("bad_json", error.to_string()),
    };
    response::ok(score_to_dto(&update_relay_read_score(
        &previous,
        &observation,
    )))
}

pub fn order_scores_json(scores_json: &str, now_ms: u64) -> JsValue {
    let dtos = match serde_json::from_str::<Vec<RelayReadScoreDto>>(scores_json) {
        Ok(dtos) => dtos,
        Err(error) => return response::error("bad_json", error.to_string()),
    };
    let scores = dtos
        .into_iter()
        .map(score_from_dto)
        .collect::<Option<Vec<_>>>();
    let Some(scores) = scores else {
        return response::error("bad_score", "relay score row is invalid");
    };
    let ordered = order_relay_read_scores(&scores, now_ms)
        .iter()
        .map(score_to_dto)
        .collect::<Vec<_>>();
    response::ok(ordered)
}

pub fn normalize_filter_shape_json(raw: &str) -> JsValue {
    response::ok(normalize_filter_shape(raw))
}

fn parse_score(score_json: &str) -> Result<RelayReadScore, JsValue> {
    let dto = serde_json::from_str::<RelayReadScoreDto>(score_json)
        .map_err(|error| response::error("bad_json", error.to_string()))?;
    score_from_dto(dto).ok_or_else(|| response::error("bad_score", "relay score row is invalid"))
}
