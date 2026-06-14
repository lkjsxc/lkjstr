use std::cell::RefCell;

use serde::Serialize;
use wasm_bindgen::prelude::JsValue;

thread_local! {
    static COUNTERS: RefCell<FeedGeometryStatsCounters> =
        RefCell::new(FeedGeometryStatsCounters::default());
}

#[derive(Clone, Copy)]
pub(crate) enum FeedGeometryOperation {
    Estimate,
    Measurement,
    Reservation,
    FragmentPlan,
    AnchorCapture,
    AnchorReconcile,
}

#[derive(Default)]
struct FeedGeometryStatsCounters {
    estimates: u64,
    measurement_updates: u64,
    reservations: u64,
    fragment_plans: u64,
    anchor_captures: u64,
    anchor_reconciles: u64,
    errors: u64,
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
    COUNTERS.with_borrow_mut(|counters| counters.record_call(operation));
}

pub(crate) fn record_error() {
    COUNTERS.with_borrow_mut(|counters| {
        counters.errors = counters.errors.saturating_add(1);
    });
}

pub(crate) fn snapshot_js() -> JsValue {
    to_value(&COUNTERS.with_borrow(FeedGeometryStatsCounters::snapshot))
}

#[cfg(debug_assertions)]
pub(crate) fn reset_for_test() {
    COUNTERS.with_borrow_mut(FeedGeometryStatsCounters::clear);
}

impl FeedGeometryStatsCounters {
    fn record_call(&mut self, operation: FeedGeometryOperation) {
        match operation {
            FeedGeometryOperation::Estimate => {
                self.estimates = self.estimates.saturating_add(1);
            }
            FeedGeometryOperation::Measurement => {
                self.measurement_updates = self.measurement_updates.saturating_add(1);
            }
            FeedGeometryOperation::Reservation => {
                self.reservations = self.reservations.saturating_add(1);
            }
            FeedGeometryOperation::FragmentPlan => {
                self.fragment_plans = self.fragment_plans.saturating_add(1);
            }
            FeedGeometryOperation::AnchorCapture => {
                self.anchor_captures = self.anchor_captures.saturating_add(1);
            }
            FeedGeometryOperation::AnchorReconcile => {
                self.anchor_reconciles = self.anchor_reconciles.saturating_add(1);
            }
        }
    }

    fn snapshot(&self) -> FeedGeometryStatsSnapshot {
        FeedGeometryStatsSnapshot {
            status: "available",
            estimates: self.estimates,
            measurement_updates: self.measurement_updates,
            reservations: self.reservations,
            fragment_plans: self.fragment_plans,
            anchor_captures: self.anchor_captures,
            anchor_reconciles: self.anchor_reconciles,
            errors: self.errors,
        }
    }

    #[cfg(debug_assertions)]
    fn clear(&mut self) {
        *self = Self::default();
    }
}

fn to_value(snapshot: &FeedGeometryStatsSnapshot) -> JsValue {
    serde_wasm_bindgen::to_value(snapshot).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counters_are_bounded_aggregates() {
        let mut counters = FeedGeometryStatsCounters::default();
        counters.record_call(FeedGeometryOperation::Estimate);
        counters.record_call(FeedGeometryOperation::AnchorReconcile);
        counters.errors = 1;

        let snapshot = counters.snapshot();

        assert_eq!(snapshot.status, "available");
        assert_eq!(snapshot.estimates, 1);
        assert_eq!(snapshot.anchor_reconciles, 1);
        assert_eq!(snapshot.errors, 1);
    }
}
