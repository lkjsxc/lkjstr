#![doc = "Pure live lease reducer."]

mod reducer;
mod reducer_tail;
mod types;

pub use reducer::LiveLeaseState;
pub use types::{
    LiveIngressOutcome, LiveLeaseCounts, LiveLeaseEffect, LiveLeaseEffectKind, LiveLeaseOutcome,
};
