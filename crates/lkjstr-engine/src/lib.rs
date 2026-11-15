//! Worker host for the pure engine. No DOM, UI framework or global mutable state.
pub mod browser;
#[cfg(all(target_arch = "wasm32", feature = "worker"))]
mod worker;
pub use lkjstr_core::engine::*;
#[cfg(all(target_arch = "wasm32", feature = "worker"))]
pub use worker::{start, start_port_host, start_shared};

#[cfg(all(target_arch = "wasm32", feature = "worker"))]
mod measure;
