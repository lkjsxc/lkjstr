#![doc = "Pure feed row geometry estimation."]

mod anchor;
mod estimate;
mod features;
mod model;

pub use anchor::{AnchorCompensation, anchor_compensation_for_height_delta};
pub use estimate::{GeometryEstimateSource, RowGeometryEstimate, estimate_row_geometry};
pub use features::{RowGeometryFeatures, RowKind, geometry_bucket_key};
pub use model::{RowGeometryModel, RowHeightObservation, update_row_geometry_model};

#[cfg(test)]
mod tests;
