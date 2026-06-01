#![doc = "Pure relay demand and lease planning state."]

mod canonical;
mod fingerprint;
mod registry;
mod registry_tail;
mod types;

pub use canonical::{canonical_filters_key, canonical_relays, canonical_relays_key};
pub use fingerprint::{
    demand_lease_key, demand_to_wire_request, lease_key_from_fingerprint,
    normalized_demand_filters, wire_equivalent_fingerprint,
};
pub use registry::{
    DemandAttachAction, DemandAttachOutcome, DemandDetachAction, DemandDetachOutcome,
    DemandLeaseRegistry, DemandLeaseSnapshot, DemandRegistryCounts, DemandVisibilityAction,
    DemandVisibilityOutcome,
};
pub use types::{
    Demand, DemandPhase, DemandPriority, DemandPurpose, DemandSurface, DemandVisibility,
    DemandWireRequest, default_demand_staleness_ms,
};
