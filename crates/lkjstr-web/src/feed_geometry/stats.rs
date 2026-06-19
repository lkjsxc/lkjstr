use crate::runtime_counter_state::{increment_counter, read_counter, slot};
use serde::Serialize;
use wasm_bindgen::prelude::JsValue;

const SLOT: &str = "__lkjstrFeedGeometryStats";

#[derive(Clone, Copy)]
pub(crate) enum FeedGeometryOperation {
    Estimate,
    Measurement,
    Reservation,
    FragmentPlan,
    AnchorCapture,
    AnchorReconcile,
}

#[derive(Serialize)]
struct FeedGeometryStatsSnapshot {
    status: &'static str,
    estimates: u64,
    measurement_updates: u64,
    reservations: u64,
    fragment_plans: u64,
    anchor_captures: u64,
    anchor_reconciles: u64,
    errors: u64,
}

pub(crate) fn record_call(operation: FeedGeometryOperation) {
    increment_counter(&slot(SLOT), operation.key());
}

pub(crate) fn record_error() {
    increment_counter(&slot(SLOT), "errors");
}

pub(crate) fn snapshot_js() -> JsValue {
    to_value(&snapshot())
}

#[cfg(debug_assertions)]
pub(crate) fn reset_for_test() {
    crate::runtime_counter_state::clear_slot(SLOT);
}

impl FeedGeometryOperation {
    fn key(self) -> &'static str {
        match self {
            FeedGeometryOperation::Estimate => "estimates",
            FeedGeometryOperation::Measurement => "measurement_updates",
            FeedGeometryOperation::Reservation => "reservations",
            FeedGeometryOperation::FragmentPlan => "fragment_plans",
            FeedGeometryOperation::AnchorCapture => "anchor_captures",
            FeedGeometryOperation::AnchorReconcile => "anchor_reconciles",
        }
    }
}

fn snapshot() -> FeedGeometryStatsSnapshot {
    let state = slot(SLOT);
    FeedGeometryStatsSnapshot {
        status: "available",
        estimates: read_counter(&state, "estimates"),
        measurement_updates: read_counter(&state, "measurement_updates"),
        reservations: read_counter(&state, "reservations"),
        fragment_plans: read_counter(&state, "fragment_plans"),
        anchor_captures: read_counter(&state, "anchor_captures"),
        anchor_reconciles: read_counter(&state, "anchor_reconciles"),
        errors: read_counter(&state, "errors"),
    }
}

fn to_value(snapshot: &FeedGeometryStatsSnapshot) -> JsValue {
    serde_wasm_bindgen::to_value(snapshot).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operation_keys_are_stable() {
        assert_eq!(FeedGeometryOperation::Estimate.key(), "estimates");
        assert_eq!(
            FeedGeometryOperation::AnchorReconcile.key(),
            "anchor_reconciles"
        );
    }
}
