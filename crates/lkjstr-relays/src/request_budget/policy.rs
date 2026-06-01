#![doc = "Local request-budget caps and intended limit policy."]

use super::{RequestBudgetInput, RequestBudgetPhase, RequestBudgetPurpose};

pub const fn default_read_page_max_events() -> u64 {
    1000
}

pub const fn max_filter_limit() -> u64 {
    500
}

pub const fn max_search_limit() -> u64 {
    100
}

pub const fn max_metadata_limit() -> u64 {
    50
}

pub const fn max_route_discovery_limit() -> u64 {
    50
}

pub const fn max_exact_lookup_limit() -> u64 {
    500
}

pub const fn request_timeout_ms() -> u64 {
    5000
}

#[must_use]
pub fn intended_filter_limit(input: &RequestBudgetInput) -> u64 {
    if let Some(requested) = positive_limit(input.requested_filter_limit) {
        return requested;
    }
    if input.phase == RequestBudgetPhase::Live {
        return 0;
    }
    if input.exact_event_lookup {
        return input.page_size.map_or(1, |page| page);
    }
    if input.purpose == Some(RequestBudgetPurpose::Metadata) {
        return input.page_size.map_or(20, |page| page);
    }
    if input.purpose == Some(RequestBudgetPurpose::RouteDiscovery) {
        return input.page_size.map_or(20, |page| page);
    }
    if input.has_search_filter || input.purpose == Some(RequestBudgetPurpose::Search) {
        return input.page_size.map_or(max_search_limit(), |page| page);
    }
    input.page_size.map_or(50, |page| page)
}

#[must_use]
pub fn app_filter_cap(purpose: Option<RequestBudgetPurpose>) -> u64 {
    match purpose {
        Some(RequestBudgetPurpose::Metadata) => max_metadata_limit(),
        Some(RequestBudgetPurpose::RouteDiscovery) => max_route_discovery_limit(),
        Some(RequestBudgetPurpose::EventLookup) => max_exact_lookup_limit(),
        Some(RequestBudgetPurpose::Search) => max_search_limit(),
        _ => max_filter_limit(),
    }
}

#[must_use]
pub const fn positive_limit(value: Option<u64>) -> Option<u64> {
    match value {
        Some(limit) if limit > 0 => Some(limit),
        _ => None,
    }
}
