#![doc = "Rust-owned relay read scoring reducers."]

mod decay;
mod fairness;
mod key;
mod observation;
mod ordering;
mod score;
mod update;

pub use decay::{
    RELAY_RELIABILITY_HALF_LIFE_MS, SCAN_DENSITY_HALF_LIFE_MS, decay_relay_read_score,
};
pub use fairness::{
    FAIRNESS_FULL_CREDIT_MS, FAIRNESS_RETRY_DELAY_MS, apply_fairness_credit, fairness_credit,
};
pub use key::{
    ReadDirection, ReadPhase, ReadPurpose, ReadSurface, RelayReadScoreKey, RelayReadScoreKeyInput,
    normalize_filter_shape, score_key_id,
};
pub use observation::RelayReadObservation;
pub use ordering::{
    RelayReadScoreCandidate, compare_relay_read_scores, order_relay_read_candidates,
    order_relay_read_scores,
};
pub use score::{NEUTRAL_COMPONENT, NEUTRAL_PENALTY, RelayReadScore, SCORE_SAMPLE_CAP};
pub use update::{EVENT_LIMIT_PENALTY, SPEED_CEILING_MS, update_relay_read_score};

#[cfg(test)]
mod tests;
