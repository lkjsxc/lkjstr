//! Owned, worker-safe browser effects. Dropping the host releases all work.
pub mod http;
pub mod idb;
mod idb_commit;
pub mod promise;
pub mod socket;
pub mod timer;
