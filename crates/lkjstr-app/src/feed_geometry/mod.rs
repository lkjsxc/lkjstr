#![doc = "Pure feed row geometry estimation."]

mod anchor;
mod estimate;
mod features;
mod hash;
mod model;
mod reservation;
mod reservation_types;
mod width_bucket;

pub use anchor::{
    AnchorCompensation, AnchorConfidence, AnchorReconcileResult, FeedScrollAnchor, MeasuredFeedRow,
    anchor_compensation_for_height_delta, capture_feed_anchor, reconcile_feed_anchor,
};
pub use estimate::{GeometryEstimateSource, RowGeometryEstimate, estimate_row_geometry};
pub use features::{RowGeometryFeatures, RowKind, event_geometry_features, geometry_bucket_key};
pub use hash::{ContentShapeInput, MaterializationTier, content_shape_hash};
pub use model::{RowGeometryModel, RowHeightObservation, update_row_geometry_model};
pub use reservation::next_reserved_height;
pub use reservation_types::{
    EnrichmentResolutionState, FeedRowReservationInput, GeometryAction, GeometryConfidence,
    GeometryKey, ReservedHeightDecision, ReservedHeightReason, RowGeometryState,
};
pub use width_bucket::WidthBucket;

#[cfg(test)]
mod reservation_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tier_tests;
