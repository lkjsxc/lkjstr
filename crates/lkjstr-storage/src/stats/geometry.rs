#![doc = "Stats projection for feed row-height geometry tables."]

use serde::{Deserialize, Serialize};

use super::StorageInventoryRow;

const OBSERVATIONS_TABLE: &str = "feed_row_height_observations";
const MODELS_TABLE: &str = "feed_row_height_models";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageFeedGeometryStats {
    pub status: String,
    pub observation_rows: Option<u64>,
    pub model_rows: Option<u64>,
    pub problem_reason: Option<String>,
}

impl StorageFeedGeometryStats {
    #[must_use]
    pub fn unavailable(reason: &str) -> Self {
        Self {
            status: "unavailable".to_string(),
            observation_rows: None,
            model_rows: None,
            problem_reason: Some(reason.to_string()),
        }
    }

    pub(super) fn from_inventory_rows(rows: &[StorageInventoryRow]) -> Self {
        let observations = row_count(rows, OBSERVATIONS_TABLE);
        let models = row_count(rows, MODELS_TABLE);
        Self {
            status: status(observations.count, models.count).to_string(),
            observation_rows: observations.count,
            model_rows: models.count,
            problem_reason: observations
                .problem_reason
                .or(models.problem_reason)
                .or_else(|| missing_reason(observations.found, models.found)),
        }
    }
}

struct FeedGeometryRowCount {
    count: Option<u64>,
    problem_reason: Option<String>,
    found: bool,
}

fn row_count(rows: &[StorageInventoryRow], table: &str) -> FeedGeometryRowCount {
    rows.iter()
        .find(|row| row.table == table)
        .map(|row| FeedGeometryRowCount {
            count: row.row_count,
            problem_reason: row.problem_reason.clone(),
            found: true,
        })
        .unwrap_or(FeedGeometryRowCount {
            count: None,
            problem_reason: None,
            found: false,
        })
}

fn status(observation_rows: Option<u64>, model_rows: Option<u64>) -> &'static str {
    match (observation_rows, model_rows) {
        (Some(_), Some(_)) => "available",
        (None, None) => "unavailable",
        _ => "partial",
    }
}

fn missing_reason(observations_found: bool, models_found: bool) -> Option<String> {
    (!observations_found || !models_found).then(|| "not-recorded".to_string())
}
