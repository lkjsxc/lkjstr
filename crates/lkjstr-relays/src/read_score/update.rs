use super::observation::RelayReadObservation;
use super::score::{RelayReadScore, ScoreComponents, clamp01, finalize_score};

pub const SPEED_CEILING_MS: u64 = 10_000;
pub const EMPTY_YIELD_REFERENCE_COUNT: u64 = 10;
pub const EVENT_LIMIT_PENALTY: f64 = 0.08;

const FIRST_SAMPLE_WEIGHT: f64 = 1.0;
const EARLY_SAMPLE_WEIGHT: f64 = 0.25;
const LATE_SAMPLE_WEIGHT: f64 = 0.10;
const EARLY_SAMPLE_LIMIT: u64 = 20;
const PARTIAL_EVENT_RELIABILITY: f64 = 0.65;
const EMPTY_NON_TERMINAL_RELIABILITY: f64 = 0.5;

pub fn update_relay_read_score(
    previous: &RelayReadScore,
    observation: &RelayReadObservation,
) -> RelayReadScore {
    let weight = smoothing_weight(previous.sample_count);
    finalize_score(ScoreComponents {
        key: previous.key.clone(),
        reliability: smooth(previous.reliability, reliability(observation), weight),
        first_event_speed: smooth(
            previous.first_event_speed,
            first_event_speed(observation),
            weight,
        ),
        eose_speed: smooth(previous.eose_speed, eose_speed(observation), weight),
        useful_yield: smooth(previous.useful_yield, useful_yield(observation), weight),
        unique_yield: smooth(previous.unique_yield, unique_yield(observation), weight),
        penalty: smooth(previous.penalty, penalty(observation), weight),
        fairness_credit: previous.fairness_credit,
        sample_count: previous.sample_count.saturating_add(1),
        updated_at_ms: observation.updated_at_ms,
    })
}

pub fn smoothing_weight(previous_sample_count: u64) -> f64 {
    if previous_sample_count == 0 {
        FIRST_SAMPLE_WEIGHT
    } else if previous_sample_count < EARLY_SAMPLE_LIMIT {
        EARLY_SAMPLE_WEIGHT
    } else {
        LATE_SAMPLE_WEIGHT
    }
}

fn reliability(observation: &RelayReadObservation) -> f64 {
    if observation.completed_without_failure() {
        1.0
    } else if observation.terminal_failure() {
        0.0
    } else if observation.produced_event_before_timeout() {
        PARTIAL_EVENT_RELIABILITY
    } else {
        EMPTY_NON_TERMINAL_RELIABILITY
    }
}

fn first_event_speed(observation: &RelayReadObservation) -> f64 {
    observation
        .first_event_ms
        .map(|time| speed_score(latency_ms(observation.started_at_ms, time)))
        .unwrap_or(0.25)
}

fn eose_speed(observation: &RelayReadObservation) -> f64 {
    observation
        .eose_ms
        .map(|time| speed_score(latency_ms(observation.started_at_ms, time)))
        .unwrap_or(0.25)
}

fn useful_yield(observation: &RelayReadObservation) -> f64 {
    if observation.final_count > 0 {
        ratio(observation.event_count, observation.final_count)
    } else {
        ratio(observation.event_count, EMPTY_YIELD_REFERENCE_COUNT)
    }
}

fn unique_yield(observation: &RelayReadObservation) -> f64 {
    if observation.event_count > 0 {
        ratio(observation.unique_event_count, observation.event_count)
    } else {
        0.0
    }
}

fn penalty(observation: &RelayReadObservation) -> f64 {
    clamp01(
        flag(observation.timeout) * 0.35
            + flag(observation.socket_error) * 0.30
            + flag(observation.closed) * 0.20
            + flag(observation.auth) * 0.20
            + flag(observation.event_limit_reached) * EVENT_LIMIT_PENALTY,
    )
}

fn speed_score(latency_ms: u64) -> f64 {
    let bounded = latency_ms.min(SPEED_CEILING_MS) as f64;
    1.0 - bounded / SPEED_CEILING_MS as f64
}

fn latency_ms(started_at_ms: u64, observed_at_ms: u64) -> u64 {
    observed_at_ms.saturating_sub(started_at_ms)
}

fn ratio(numerator: u64, denominator: u64) -> f64 {
    if denominator == 0 {
        0.0
    } else {
        clamp01(numerator as f64 / denominator as f64)
    }
}

fn smooth(previous: f64, next: f64, weight: f64) -> f64 {
    previous * (1.0 - weight) + next * weight
}

fn flag(value: bool) -> f64 {
    if value { 1.0 } else { 0.0 }
}
