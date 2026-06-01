#![doc = "Demand fingerprint and wire request derivation."]

use lkjstr_protocol::NostrFilter;

use crate::relay_subscription_hash;

use super::canonical::fields;
use super::{
    Demand, DemandPhase, DemandWireRequest, canonical_filters_key, canonical_relays,
    canonical_relays_key,
};

#[must_use]
pub fn normalized_demand_filters(demand: &Demand, now_sec: u64) -> Vec<NostrFilter> {
    if demand.phase != DemandPhase::Live {
        return demand.filters.clone();
    }
    let since = demand
        .since
        .map_or(now_sec.saturating_sub(30), |value| value);
    demand
        .filters
        .iter()
        .map(|filter| {
            let mut next = filter.clone();
            next.since = Some(since);
            next.limit = None;
            next
        })
        .collect()
}

#[must_use]
pub fn wire_equivalent_fingerprint(demand: &Demand, now_sec: u64) -> String {
    let filters = normalized_demand_filters(demand, now_sec);
    let since = optional_number(demand.since);
    let until = optional_number(demand.until);
    let limit = optional_number(demand.limit);
    let channel = match &demand.channel {
        Some(value) => value.as_str(),
        None => "",
    };
    fields(&[
        demand.phase.as_key(),
        demand.purpose.as_key(),
        &canonical_relays_key(&demand.relays),
        &canonical_filters_key(&filters),
        &since,
        &until,
        &limit,
        channel,
    ])
}

#[must_use]
pub fn lease_key_from_fingerprint(fingerprint: &str) -> String {
    format!("lease:{}", relay_subscription_hash(fingerprint, 12))
}

#[must_use]
pub fn demand_lease_key(demand: &Demand, now_sec: u64) -> String {
    lease_key_from_fingerprint(&wire_equivalent_fingerprint(demand, now_sec))
}

#[must_use]
pub fn demand_to_wire_request(demand: &Demand, now_sec: u64) -> DemandWireRequest {
    DemandWireRequest {
        key: demand_lease_key(demand, now_sec),
        relays: canonical_relays(&demand.relays),
        filters: normalized_demand_filters(demand, now_sec),
        purpose: demand.purpose,
    }
}

fn optional_number(value: Option<u64>) -> String {
    value.map_or_else(String::new, |number| number.to_string())
}
