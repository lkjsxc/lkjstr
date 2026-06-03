#![doc = "Pure real-data feed level-of-detail tree."]

mod block;
mod query;
mod tree;

pub use block::{FeedLodBlock, FeedLodRow, FeedLodRowKind, RowCoverageState};
pub use query::{
    CoverageProjection, MaterializationPlan, RowLocation, RowRange, coverage_gap_projection,
    materialization_plan, offset_to_row, visible_range,
};
pub use tree::{FeedLodTree, TreeUpdate, build_lod_tree, height_delta_update};

#[cfg(test)]
mod tests;
