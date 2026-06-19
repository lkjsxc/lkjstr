#![doc = "Stats projection for scan optimizer inventory rows."]

use serde::{Deserialize, Serialize};

use super::StorageInventoryRow;

const SCAN_HINT_TABLE: &str = "feed_scan_hints";
const DECISION_TRACE_TABLE: &str = "feed_scan_decision_traces";
const DENSITY_MODEL_TABLE: &str = "feed_scan_density_models";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageOptimizerStats {
    pub status: String,
    pub scan_hint_rows: Option<u64>,
    pub decision_trace_rows: Option<u64>,
    pub density_model_rows: Option<u64>,
    pub problem_reason: Option<String>,
}

impl StorageOptimizerStats {
    #[must_use]
    pub fn unavailable(reason: &str) -> Self {
        Self {
            status: "unavailable".to_string(),
            scan_hint_rows: None,
            decision_trace_rows: None,
            density_model_rows: None,
            problem_reason: Some(reason.to_string()),
        }
    }

    pub(super) fn from_inventory_rows(rows: &[StorageInventoryRow]) -> Self {
        let hints = row_count(rows, SCAN_HINT_TABLE);
        let traces = row_count(rows, DECISION_TRACE_TABLE);
        let models = row_count(rows, DENSITY_MODEL_TABLE);
        Self {
            status: status(&[hints.count, traces.count, models.count]).to_string(),
            scan_hint_rows: hints.count,
            decision_trace_rows: traces.count,
            density_model_rows: models.count,
            problem_reason: hints
                .problem_reason
                .or(traces.problem_reason)
                .or(models.problem_reason)
                .or_else(|| missing_reason(&[hints.found, traces.found, models.found])),
        }
    }
}

struct OptimizerRowCount {
    count: Option<u64>,
    problem_reason: Option<String>,
    found: bool,
}

fn row_count(rows: &[StorageInventoryRow], table: &str) -> OptimizerRowCount {
    rows.iter()
        .find(|row| row.table == table)
        .map(|row| OptimizerRowCount {
            count: row.row_count,
            problem_reason: row.problem_reason.clone(),
            found: true,
        })
        .unwrap_or(OptimizerRowCount {
            count: None,
            problem_reason: None,
            found: false,
        })
}

fn status(counts: &[Option<u64>]) -> &'static str {
    if counts.iter().all(Option::is_some) {
        "available"
    } else if counts.iter().all(Option::is_none) {
        "unavailable"
    } else {
        "partial"
    }
}

fn missing_reason(found: &[bool]) -> Option<String> {
    found
        .iter()
        .any(|item| !item)
        .then(|| "not-recorded".to_string())
}
