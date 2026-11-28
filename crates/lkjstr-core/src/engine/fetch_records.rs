//! R0: local, disposable observations. No product policy reads this state.
mod ghosts;
mod ledger;
mod types;
pub use ledger::*;
pub use types::*;

mod plain_image;
pub use plain_image::PlainImage;

#[cfg(test)]
mod tests;
