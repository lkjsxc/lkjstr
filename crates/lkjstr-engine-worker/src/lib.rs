//! Worker host for the pure engine. No DOM, UI framework or global mutable state.
pub mod browser;
#[cfg(target_arch = "wasm32")]
mod worker;
pub use lkjstr_core::engine::*;
#[cfg(target_arch = "wasm32")]
pub use worker::{start, start_port_host, start_shared};

#[cfg(target_arch = "wasm32")]
mod measure;
