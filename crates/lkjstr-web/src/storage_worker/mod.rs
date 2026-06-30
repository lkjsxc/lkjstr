#![doc = "SQLite storage worker host adapter."]

#[cfg(target_arch = "wasm32")]
mod broker;
mod client;
mod client_lifecycle;
mod outcome;
mod owner_lease;
mod runtime;
mod runtime_events;
mod types;

pub use client::{StorageWorkerClient, StorageWorkerDiagnostics, StorageWorkerRequest};
pub use outcome::STORAGE_WORKER_TABLE;
pub use types::{
    BatchMode, OpenDatabase, SqlParams, SqlRow, SqlScalar, SqlStep, StorageDiagnostics, StorageOp,
    StorageRequest, StorageResponse, WorkerOutcome,
};

pub const DEFAULT_WORKER_URL: &str = "/sqlite-opfs-worker.js";
