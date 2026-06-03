use super::block::{FeedLodBlock, FeedLodRow, RowCoverageState};

const BLOCK_SIZE: usize = 32;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedLodTree {
    pub rows: Vec<FeedLodRow>,
    pub blocks: Vec<FeedLodBlock>,
    pub total_height_px: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreeUpdate {
    pub tree: FeedLodTree,
    pub height_delta_px: i32,
}

#[must_use]
pub fn build_lod_tree(rows: Vec<FeedLodRow>) -> FeedLodTree {
    let blocks = rows
        .chunks(BLOCK_SIZE)
        .enumerate()
        .scan(0_u64, |height_before, (block_index, chunk)| {
            let start = block_index * BLOCK_SIZE;
            let block = build_block(start, chunk, *height_before);
            *height_before = height_before.saturating_add(block.height_px);
            Some(block)
        })
        .collect::<Vec<_>>();
    let total_height_px = blocks
        .last()
        .map(|block| block.cumulative_height_before_px + block.height_px)
        .unwrap_or(0);
    FeedLodTree {
        rows,
        blocks,
        total_height_px,
    }
}

#[must_use]
pub fn height_delta_update(tree: &FeedLodTree, row_id: &str, measured_height: u32) -> TreeUpdate {
    let rows = tree
        .rows
        .iter()
        .map(|row| update_row_height(row, row_id, measured_height))
        .collect::<Vec<_>>();
    let previous = tree
        .rows
        .iter()
        .find(|row| row.row_id == row_id)
        .map(FeedLodRow::height_px)
        .unwrap_or(measured_height);
    TreeUpdate {
        tree: build_lod_tree(rows),
        height_delta_px: measured_height as i32 - previous as i32,
    }
}

fn build_block(start_index: usize, rows: &[FeedLodRow], height_before: u64) -> FeedLodBlock {
    let end_index = start_index + rows.len();
    FeedLodBlock {
        start_index,
        end_index,
        cumulative_height_before_px: height_before,
        height_px: rows.iter().map(|row| u64::from(row.height_px())).sum(),
        min_timestamp_seconds: rows
            .iter()
            .map(|row| row.timestamp_seconds)
            .min()
            .unwrap_or(0),
        max_timestamp_seconds: rows
            .iter()
            .map(|row| row.timestamp_seconds)
            .max()
            .unwrap_or(0),
        loaded_count: rows
            .iter()
            .filter(|row| row.coverage == RowCoverageState::Loaded)
            .count(),
        unresolved_count: rows
            .iter()
            .filter(|row| row.coverage != RowCoverageState::Loaded)
            .count(),
    }
}

fn update_row_height(row: &FeedLodRow, row_id: &str, measured_height: u32) -> FeedLodRow {
    if row.row_id == row_id {
        let mut next = row.clone();
        next.measured_height_px = Some(measured_height.max(1));
        next
    } else {
        row.clone()
    }
}
