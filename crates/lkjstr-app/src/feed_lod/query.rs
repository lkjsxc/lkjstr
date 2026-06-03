use super::block::RowCoverageState;
use super::tree::FeedLodTree;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowLocation {
    pub index: usize,
    pub row_id: String,
    pub offset_top_px: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowRange {
    pub start_index: usize,
    pub end_index: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MaterializationPlan {
    pub full_row_ids: Vec<String>,
    pub shell_row_ids: Vec<String>,
    pub block_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoverageProjection {
    pub uncovered_count: usize,
    pub incomplete_count: usize,
    pub dense_count: usize,
}

#[must_use]
pub fn offset_to_row(tree: &FeedLodTree, scroll_offset: u64) -> Option<RowLocation> {
    let block = tree.blocks.iter().find(|block| {
        let start = block.cumulative_height_before_px;
        scroll_offset < start.saturating_add(block.height_px)
    })?;
    let mut offset = block.cumulative_height_before_px;
    for (index, row) in tree.rows[block.start_index..block.end_index]
        .iter()
        .enumerate()
    {
        let absolute = block.start_index + index;
        let height = u64::from(row.height_px());
        if scroll_offset < offset.saturating_add(height) {
            return Some(RowLocation {
                index: absolute,
                row_id: row.row_id.clone(),
                offset_top_px: offset,
            });
        }
        offset = offset.saturating_add(height);
    }
    None
}

#[must_use]
pub fn visible_range(
    tree: &FeedLodTree,
    scroll_offset: u64,
    viewport_height: u64,
    overscan: usize,
) -> RowRange {
    let start = offset_to_row(tree, scroll_offset).map_or(0, |location| location.index);
    let end_offset = scroll_offset.saturating_add(viewport_height);
    let end = offset_to_row(tree, end_offset)
        .map_or(tree.rows.len(), |location| location.index.saturating_add(1));
    RowRange {
        start_index: start.saturating_sub(overscan),
        end_index: end.saturating_add(overscan).min(tree.rows.len()),
    }
}

#[must_use]
pub fn materialization_plan(tree: &FeedLodTree, range: &RowRange) -> MaterializationPlan {
    let rows = &tree.rows[range.start_index..range.end_index];
    MaterializationPlan {
        full_row_ids: rows.iter().map(|row| row.row_id.clone()).collect(),
        shell_row_ids: tree
            .rows
            .iter()
            .filter(|row| !rows.iter().any(|visible| visible.row_id == row.row_id))
            .take(64)
            .map(|row| row.row_id.clone())
            .collect(),
        block_count: tree.blocks.len(),
    }
}

#[must_use]
pub fn coverage_gap_projection(tree: &FeedLodTree) -> CoverageProjection {
    CoverageProjection {
        uncovered_count: count_coverage(tree, RowCoverageState::Uncovered),
        incomplete_count: count_coverage(tree, RowCoverageState::Incomplete),
        dense_count: count_coverage(tree, RowCoverageState::Dense),
    }
}

fn count_coverage(tree: &FeedLodTree, state: RowCoverageState) -> usize {
    tree.rows.iter().filter(|row| row.coverage == state).count()
}
