#![doc = "SQLite storage worker host adapter."]

mod client;
mod outcome;
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
