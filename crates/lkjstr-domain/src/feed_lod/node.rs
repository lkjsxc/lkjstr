#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedLodLevel {
    Full,
    Shell,
    Block,
    Recovery,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryRecipe {
    pub feed_key: String,
    pub route_fingerprint: String,
    pub since: i64,
    pub until: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedLodRow {
    pub id: String,
    pub created_at: i64,
    pub estimated_height: u32,
    pub measured_height: Option<u32>,
    pub retention_score: i32,
    pub hard_protected: bool,
    pub recipe: RecoveryRecipe,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedLodNode {
    pub id: String,
    pub level: FeedLodLevel,
    pub start: usize,
    pub count: usize,
    pub height: u32,
    pub min_created_at: i64,
    pub max_created_at: i64,
    pub retention_score: i32,
    pub hard_protected: bool,
    pub recipe: RecoveryRecipe,
}

pub fn build_lod_tree(rows: &[FeedLodRow], block_size: usize) -> Vec<FeedLodNode> {
    let size = block_size.clamp(1, 64);
    let mut nodes = Vec::new();
    let mut start = 0;
    while start < rows.len() {
        let end = rows.len().min(start + size);
        if let Some(node) = block_node(rows, start, end) {
            nodes.push(node);
        }
        start = end;
    }
    nodes
}

pub fn next_level(level: FeedLodLevel) -> Option<FeedLodLevel> {
    match level {
        FeedLodLevel::Full => Some(FeedLodLevel::Shell),
        FeedLodLevel::Shell => Some(FeedLodLevel::Block),
        FeedLodLevel::Block => Some(FeedLodLevel::Recovery),
        FeedLodLevel::Recovery => None,
    }
}

fn block_node(rows: &[FeedLodRow], start: usize, end: usize) -> Option<FeedLodNode> {
    let first = rows.get(start)?;
    let mut height = 0;
    let mut min_created_at = first.created_at;
    let mut max_created_at = first.created_at;
    let mut score = first.retention_score;
    let mut protected = false;
    for row in &rows[start..end] {
        height += row.measured_height.unwrap_or(row.estimated_height);
        min_created_at = min_created_at.min(row.created_at);
        max_created_at = max_created_at.max(row.created_at);
        score = score.min(row.retention_score);
        protected |= row.hard_protected;
    }
    Some(FeedLodNode {
        id: format!("block:{start}:{end}"),
        level: FeedLodLevel::Full,
        start,
        count: end - start,
        height,
        min_created_at,
        max_created_at,
        retention_score: score,
        hard_protected: protected,
        recipe: first.recipe.clone(),
    })
}
