#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RetentionSignals {
    pub visibility: i32,
    pub active_owner: i32,
    pub user_interaction: i32,
    pub recency: i32,
    pub notification: i32,
    pub thread_anchor: i32,
    pub route_value: i32,
    pub coverage_value: i32,
    pub recovery_cost: i32,
    pub byte_cost: i32,
}

pub fn retention_score(signals: RetentionSignals) -> i32 {
    signals.visibility
        + signals.active_owner
        + signals.user_interaction
        + signals.recency
        + signals.notification
        + signals.thread_anchor
        + signals.route_value
        + signals.coverage_value
        + signals.recovery_cost
        - signals.byte_cost
}

pub fn low_value(score: i32, threshold: i32) -> bool {
    score < threshold
}
