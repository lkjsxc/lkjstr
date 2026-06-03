use super::score::{
    NEUTRAL_COMPONENT, NEUTRAL_PENALTY, RelayReadScore, ScoreComponents, finalize_score,
};

pub const RELAY_RELIABILITY_HALF_LIFE_MS: u64 = 7 * 24 * 60 * 60 * 1_000;
pub const SCAN_DENSITY_HALF_LIFE_MS: u64 = 24 * 60 * 60 * 1_000;

pub fn decay_relay_read_score(
    score: &RelayReadScore,
    now_ms: u64,
    half_life_ms: u64,
) -> RelayReadScore {
    if now_ms <= score.updated_at_ms || half_life_ms == 0 {
        return score.clone();
    }
    let age_ms = now_ms - score.updated_at_ms;
    let retained = retained_fraction(age_ms, half_life_ms);
    finalize_score(ScoreComponents {
        key: score.key.clone(),
        reliability: decay_component(score.reliability, NEUTRAL_COMPONENT, retained),
        first_event_speed: decay_component(score.first_event_speed, NEUTRAL_COMPONENT, retained),
        eose_speed: decay_component(score.eose_speed, NEUTRAL_COMPONENT, retained),
        useful_yield: decay_component(score.useful_yield, NEUTRAL_COMPONENT, retained),
        unique_yield: decay_component(score.unique_yield, NEUTRAL_COMPONENT, retained),
        penalty: decay_component(score.penalty, NEUTRAL_PENALTY, retained),
        fairness_credit: score.fairness_credit,
        sample_count: score.sample_count,
        updated_at_ms: score.updated_at_ms,
    })
}

fn retained_fraction(age_ms: u64, half_life_ms: u64) -> f64 {
    0.5_f64.powf(age_ms as f64 / half_life_ms as f64)
}

fn decay_component(value: f64, neutral: f64, retained: f64) -> f64 {
    neutral + (value - neutral) * retained
}
