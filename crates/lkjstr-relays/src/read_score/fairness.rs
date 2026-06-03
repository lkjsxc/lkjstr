use super::score::{RelayReadScore, ScoreComponents, clamp01, finalize_score};

pub const FAIRNESS_RETRY_DELAY_MS: u64 = 6 * 60 * 60 * 1_000;
pub const FAIRNESS_FULL_CREDIT_MS: u64 = 24 * 60 * 60 * 1_000;

pub fn apply_fairness_credit(score: &RelayReadScore, now_ms: u64) -> RelayReadScore {
    let credit = fairness_credit(score.updated_at_ms, now_ms);
    finalize_score(ScoreComponents {
        key: score.key.clone(),
        reliability: score.reliability,
        first_event_speed: score.first_event_speed,
        eose_speed: score.eose_speed,
        useful_yield: score.useful_yield,
        unique_yield: score.unique_yield,
        penalty: score.penalty,
        fairness_credit: credit,
        sample_count: score.sample_count,
        updated_at_ms: score.updated_at_ms,
    })
}

pub fn fairness_credit(updated_at_ms: u64, now_ms: u64) -> f64 {
    let age = now_ms.saturating_sub(updated_at_ms);
    if age <= FAIRNESS_RETRY_DELAY_MS {
        return 0.0;
    }
    let earned = age - FAIRNESS_RETRY_DELAY_MS;
    let span = FAIRNESS_FULL_CREDIT_MS.saturating_sub(FAIRNESS_RETRY_DELAY_MS);
    if span == 0 {
        1.0
    } else {
        clamp01(earned as f64 / span as f64)
    }
}
