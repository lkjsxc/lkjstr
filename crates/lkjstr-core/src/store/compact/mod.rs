//! Canonical public-event payloads with binary identities and shared symbols.
//!
//! Protocol verification remains outside this module. Packing checks field
//! shapes and preserves every tag field, including unknown and empty values.
//! Direct Arc handles cannot alias a later allocation when a slot is reused.
//!
//! Managed accounting records owned payload and symbol allocations once across
//! all leases. Box allocations use their actual lengths; Arc charges include two
//! reference counters and layout padding. Dictionary buckets use actual Vec
//! capacities. The opaque HashMap uses a conservative capacity reservation, not
//! an allocator/RSS claim. Removing an index reference does not free a leased
//! payload. Dictionary-only symbols remain charged until reap removes them.
mod accounting;
mod atom;
mod dictionary;
mod event;
mod identity;
mod index;
mod tags;

pub use atom::{Atom, AtomRef};
pub use dictionary::Pool;
pub use event::CompactEvent;
pub(crate) use identity::Encoding;
pub use identity::{decode_id, encode_id, hex};
pub use index::OrderedEvent;
pub use tags::Tags;
pub type Id = [u8; 32];
pub type Lease = std::sync::Arc<CompactEvent>;
pub type OrderKey = (u64, Id);

#[cfg(test)]
#[path = "compact_test.rs"]
mod tests;

#[cfg(test)]
mod maintenance_test;

#[cfg(test)]
mod allocation_test;
