use super::node::{FeedLodNode, RecoveryRecipe};

pub fn recovery_recipe_for(nodes: &[FeedLodNode], row_index: usize) -> Option<RecoveryRecipe> {
    nodes
        .iter()
        .find(|node| row_index >= node.start && row_index < node.start + node.count)
        .map(|node| node.recipe.clone())
}

pub fn is_recoverable(node: &FeedLodNode) -> bool {
    !node.recipe.feed_key.is_empty() && !node.recipe.route_fingerprint.is_empty()
}
