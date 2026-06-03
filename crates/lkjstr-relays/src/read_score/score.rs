use super::key::RelayReadScoreKey;

pub const NEUTRAL_COMPONENT: f64 = 0.5;
pub const NEUTRAL_PENALTY: f64 = 0.0;
pub const SCORE_SAMPLE_CAP: u64 = 10_000;

const RELIABILITY_WEIGHT: f64 = 0.34;
const FIRST_EVENT_SPEED_WEIGHT: f64 = 0.18;
const EOSE_SPEED_WEIGHT: f64 = 0.12;
const USEFUL_YIELD_WEIGHT: f64 = 0.16;
const UNIQUE_YIELD_WEIGHT: f64 = 0.10;
const FAIRNESS_CREDIT_WEIGHT: f64 = 0.05;
const PENALTY_WEIGHT: f64 = 0.35;

#[derive(Clone, Debug, PartialEq)]
pub struct RelayReadScore {
    pub key: RelayReadScoreKey,
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

impl RelayReadScore {
    pub fn neutral(key: RelayReadScoreKey, updated_at_ms: u64) -> Self {
        finalize_score(ScoreComponents {
            key,
            reliability: NEUTRAL_COMPONENT,
            first_event_speed: NEUTRAL_COMPONENT,
            eose_speed: NEUTRAL_COMPONENT,
            useful_yield: NEUTRAL_COMPONENT,
            unique_yield: NEUTRAL_COMPONENT,
            penalty: NEUTRAL_PENALTY,
            fairness_credit: NEUTRAL_COMPONENT,
            sample_count: 0,
            updated_at_ms,
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ScoreComponents {
    pub key: RelayReadScoreKey,
    pub reliability: f64,
    pub first_event_speed: f64,
    pub eose_speed: f64,
    pub useful_yield: f64,
    pub unique_yield: f64,
    pub penalty: f64,
    pub fairness_credit: f64,
    pub sample_count: u64,
    pub updated_at_ms: u64,
}

pub fn finalize_score(input: ScoreComponents) -> RelayReadScore {
    let reliability = clamp01(input.reliability);
    let first_event_speed = clamp01(input.first_event_speed);
    let eose_speed = clamp01(input.eose_speed);
    let useful_yield = clamp01(input.useful_yield);
    let unique_yield = clamp01(input.unique_yield);
    let penalty = clamp01(input.penalty);
    let fairness_credit = clamp01(input.fairness_credit);
    let raw_score = reliability * RELIABILITY_WEIGHT
        + first_event_speed * FIRST_EVENT_SPEED_WEIGHT
        + eose_speed * EOSE_SPEED_WEIGHT
        + useful_yield * USEFUL_YIELD_WEIGHT
        + unique_yield * UNIQUE_YIELD_WEIGHT
        + fairness_credit * FAIRNESS_CREDIT_WEIGHT
        - penalty * PENALTY_WEIGHT;
    RelayReadScore {
        key: input.key,
        reliability,
        first_event_speed,
        eose_speed,
        useful_yield,
        unique_yield,
        penalty,
        fairness_credit,
        sample_count: input.sample_count.min(SCORE_SAMPLE_CAP),
        updated_at_ms: input.updated_at_ms,
        score: clamp01(raw_score),
    }
}

pub fn clamp01(value: f64) -> f64 {
    if value.is_nan() {
        NEUTRAL_COMPONENT
    } else {
        value.clamp(0.0, 1.0)
    }
}
