use lkjstr_relays::{
    RelayReadObservation, RelayReadScore, RelayReadScoreKey, RelayReadScoreKeyInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayReadScoreKeyDto {
    pub relay_url: String,
    pub surface: String,
    pub phase: String,
    pub direction: String,
    pub route_group_key: String,
    pub filter_shape: String,
    pub purpose: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayReadScoreDto {
    pub key: RelayReadScoreKeyDto,
    pub reliability: f64,
    pub first_event_speed: f64,
    pub eose_speed: f64,
    pub useful_yield: f64,
    pub unique_yield: f64,
    pub penalty: f64,
    pub fairness_credit: f64,
    pub sample_count: u64,
    pub updated_at_ms: u64,
    pub score: f64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayReadObservationDto {
    pub started_at_ms: u64,
    pub first_event_ms: Option<u64>,
    pub eose_ms: Option<u64>,
    pub duration_ms: u64,
    pub event_count: u64,
    pub unique_event_count: u64,
    pub final_count: u64,
    pub timeout: bool,
    pub closed: bool,
    pub auth: bool,
    pub socket_error: bool,
    pub event_limit_reached: bool,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub updated_at_ms: u64,
}

pub fn key_from_dto(dto: RelayReadScoreKeyDto) -> Option<RelayReadScoreKey> {
    RelayReadScoreKey::normalized(RelayReadScoreKeyInput {
        relay_url: dto.relay_url,
        surface: dto.surface,
        phase: dto.phase,
        direction: dto.direction,
        route_group_key: dto.route_group_key,
        filter_shape: dto.filter_shape,
        purpose: dto.purpose,
    })
}

pub fn key_to_dto(key: &RelayReadScoreKey) -> RelayReadScoreKeyDto {
    RelayReadScoreKeyDto {
        relay_url: key.relay_url.clone(),
        surface: key.surface.clone(),
        phase: key.phase.clone(),
        direction: key.direction.clone(),
        route_group_key: key.route_group_key.clone(),
        filter_shape: key.filter_shape.clone(),
        purpose: key.purpose.clone(),
    }
}

pub fn score_from_dto(dto: RelayReadScoreDto) -> Option<RelayReadScore> {
    Some(RelayReadScore {
        key: key_from_dto(dto.key)?,
        reliability: dto.reliability,
        first_event_speed: dto.first_event_speed,
        eose_speed: dto.eose_speed,
        useful_yield: dto.useful_yield,
        unique_yield: dto.unique_yield,
        penalty: dto.penalty,
        fairness_credit: dto.fairness_credit,
        sample_count: dto.sample_count,
        updated_at_ms: dto.updated_at_ms,
        score: dto.score,
    })
}

pub fn score_to_dto(score: &RelayReadScore) -> RelayReadScoreDto {
    RelayReadScoreDto {
        key: key_to_dto(&score.key),
        reliability: score.reliability,
        first_event_speed: score.first_event_speed,
        eose_speed: score.eose_speed,
        useful_yield: score.useful_yield,
        unique_yield: score.unique_yield,
        penalty: score.penalty,
        fairness_credit: score.fairness_credit,
        sample_count: score.sample_count,
        updated_at_ms: score.updated_at_ms,
        score: score.score,
    }
}

pub fn observation_from_dto(
    dto: RelayReadObservationDto,
    key: RelayReadScoreKey,
) -> RelayReadObservation {
    RelayReadObservation {
        key,
        started_at_ms: dto.started_at_ms,
        first_event_ms: dto.first_event_ms,
        eose_ms: dto.eose_ms,
        duration_ms: dto.duration_ms,
        event_count: dto.event_count,
        unique_event_count: dto.unique_event_count,
        final_count: dto.final_count,
        timeout: dto.timeout,
        closed: dto.closed,
        auth: dto.auth,
        socket_error: dto.socket_error,
        event_limit_reached: dto.event_limit_reached,
        bytes_sent: dto.bytes_sent,
        bytes_received: dto.bytes_received,
        updated_at_ms: dto.updated_at_ms,
    }
}
