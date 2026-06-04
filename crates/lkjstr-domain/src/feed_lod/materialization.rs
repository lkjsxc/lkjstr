use super::node::{FeedLodLevel, FeedLodNode};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MaterializationAction {
    KeepFull(String),
    KeepShell(String),
    KeepBlock(String),
    Recover(String),
}

pub fn materialization_plan(
    nodes: &[FeedLodNode],
    visible_start: usize,
    visible_end: usize,
    overscan: usize,
) -> Vec<MaterializationAction> {
    nodes
        .iter()
        .filter(|node| overlaps(node, visible_start, visible_end, overscan))
        .map(action_for)
        .collect()
}

fn overlaps(node: &FeedLodNode, start: usize, end: usize, overscan: usize) -> bool {
    let range_start = start.saturating_sub(overscan);
    let range_end = end.saturating_add(overscan);
    let node_end = node.start.saturating_add(node.count);
    node.start < range_end && node_end > range_start
}

fn action_for(node: &FeedLodNode) -> MaterializationAction {
    match node.level {
        FeedLodLevel::Full => MaterializationAction::KeepFull(node.id.clone()),
        FeedLodLevel::Shell => MaterializationAction::KeepShell(node.id.clone()),
        FeedLodLevel::Block => MaterializationAction::KeepBlock(node.id.clone()),
        FeedLodLevel::Recovery => MaterializationAction::Recover(node.id.clone()),
    }
}
