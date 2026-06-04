use super::{
    node::{FeedLodLevel, FeedLodNode, next_level},
    recovery::is_recoverable,
    score::low_value,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ForgettingDecision {
    pub node_id: String,
    pub from: FeedLodLevel,
    pub to: FeedLodLevel,
}

pub fn forgetting_plan(
    nodes: &[FeedLodNode],
    score_threshold: i32,
    max_decisions: usize,
) -> Vec<ForgettingDecision> {
    let mut candidates: Vec<&FeedLodNode> = nodes
        .iter()
        .filter(|node| !node.hard_protected)
        .filter(|node| low_value(node.retention_score, score_threshold))
        .filter(|node| node.level != FeedLodLevel::Recovery || is_recoverable(node))
        .collect();
    candidates.sort_by_key(|node| (node.retention_score, node.start));
    candidates
        .into_iter()
        .filter_map(decision_for)
        .take(max_decisions)
        .collect()
}

pub fn apply_forgetting(
    nodes: &[FeedLodNode],
    decisions: &[ForgettingDecision],
) -> Vec<FeedLodNode> {
    nodes
        .iter()
        .map(|node| apply_node(node, decisions))
        .collect()
}

fn decision_for(node: &FeedLodNode) -> Option<ForgettingDecision> {
    next_level(node.level).map(|to| ForgettingDecision {
        node_id: node.id.clone(),
        from: node.level,
        to,
    })
}

fn apply_node(node: &FeedLodNode, decisions: &[ForgettingDecision]) -> FeedLodNode {
    let mut next = node.clone();
    if let Some(decision) = decisions.iter().find(|item| item.node_id == node.id) {
        next.level = decision.to;
    }
    next
}
