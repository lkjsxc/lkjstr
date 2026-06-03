use super::features::{RowGeometryFeatures, geometry_bucket_key};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowHeightObservation {
    pub key: String,
    pub features: RowGeometryFeatures,
    pub measured_height_px: u16,
    pub width_px: u16,
    pub observed_at_ms: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowGeometryModel {
    pub bucket_key: String,
    pub average_height_px: u16,
    pub sample_count: u32,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn update_row_geometry_model(
    previous: Option<&RowGeometryModel>,
    observation: &RowHeightObservation,
) -> RowGeometryModel {
    let bucket_key = geometry_bucket_key(&observation.features);
    let sample_count = previous.map_or(1, |model| model.sample_count.saturating_add(1));
    let previous_height = previous
        .map(|model| u32::from(model.average_height_px) * model.sample_count)
        .unwrap_or(0);
    let total = previous_height.saturating_add(u32::from(observation.measured_height_px));
    RowGeometryModel {
        bucket_key,
        average_height_px: average(total, sample_count),
        sample_count,
        updated_at_ms: observation.observed_at_ms,
    }
}

fn average(total: u32, sample_count: u32) -> u16 {
    total
        .checked_div(sample_count)
        .unwrap_or(0)
        .min(u32::from(u16::MAX)) as u16
}
