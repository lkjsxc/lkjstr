use std::cmp::Ordering;

use super::fairness::apply_fairness_credit;
use super::score::RelayReadScore;

#[derive(Clone, Debug, PartialEq)]
pub struct RelayReadScoreCandidate {
    pub score: RelayReadScore,
    pub disabled: bool,
}

pub fn compare_relay_read_scores(left: &RelayReadScore, right: &RelayReadScore) -> Ordering {
    right
        .score
        .total_cmp(&left.score)
        .then_with(|| right.reliability.total_cmp(&left.reliability))
        .then_with(|| right.first_event_speed.total_cmp(&left.first_event_speed))
        .then_with(|| right.eose_speed.total_cmp(&left.eose_speed))
        .then_with(|| left.key.relay_url.cmp(&right.key.relay_url))
}

pub fn order_relay_read_scores(scores: &[RelayReadScore], now_ms: u64) -> Vec<RelayReadScore> {
    let mut ordered: Vec<RelayReadScore> = scores
        .iter()
        .map(|score| apply_fairness_credit(score, now_ms))
        .collect();
    ordered.sort_by(compare_relay_read_scores);
    ordered
}

pub fn order_relay_read_candidates(
    candidates: &[RelayReadScoreCandidate],
    now_ms: u64,
) -> Vec<RelayReadScore> {
    let mut ordered: Vec<RelayReadScore> = candidates
        .iter()
        .filter(|candidate| !candidate.disabled)
        .map(|candidate| apply_fairness_credit(&candidate.score, now_ms))
        .collect();
    ordered.sort_by(compare_relay_read_scores);
    ordered
}
