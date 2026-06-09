#![doc = "Typed storage operation outcomes."]

mod problem;
mod result;

pub use problem::{StorageOperation, StorageProblem, StorageProblemKind};
pub use result::StorageOutcome;
