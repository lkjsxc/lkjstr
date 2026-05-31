#![doc = "Rust storage contracts for lkjstr."]

pub mod data_class;
pub mod ledger;
pub mod manifest;
pub mod outcome;
pub mod resource;
mod table_specs;

pub use data_class::{StorageDataClass, StorageInventoryGroup};
pub use ledger::{
    LedgerResourceSpec, direct_ledger_resource_specs, ledger_resource_kinds, ledger_resource_spec,
    ledger_resource_specs,
};
pub use manifest::{
    StorageTableSpec, is_storage_table_name, storage_manifest_group, storage_table_names,
    storage_table_spec, storage_table_specs,
};
pub use outcome::{StorageOperation, StorageOutcome, StorageProblem};
pub use resource::{CacheOwnerKind, CacheResourceKind};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "storage";
