use std::collections::BTreeMap;

use lkjstr_protocol::NostrFilter;

use super::{
    CustomRequest, CustomRequestRelayFilters, CustomRequestRelayLimitClamp,
    CustomRequestRelayLimitInput,
};

pub(super) fn apply_custom_request_relay_limits(
    mut request: CustomRequest,
    relays: &[String],
    limits: &[CustomRequestRelayLimitInput],
) -> CustomRequest {
    let limits_by_relay = limits
        .iter()
        .map(|item| (item.relay_url.as_str(), item))
        .collect::<BTreeMap<_, _>>();
    let mut relay_clamps = Vec::new();
    let mut relay_filters = Vec::new();
    for relay in relays {
        let Some(limit) = limits_by_relay.get(relay.as_str()) else {
            continue;
        };
        let (filters, clamps) = filters_for_relay(relay, &request.filters, limit);
        if !clamps.is_empty() {
            relay_clamps.extend(clamps);
            relay_filters.push(CustomRequestRelayFilters {
                relay_url: relay.clone(),
                filters,
            });
        }
    }
    request.relay_limit_clamps = relay_clamps;
    request.relay_filters = relay_filters;
    request
}

fn filters_for_relay(
    relay: &str,
    filters: &[NostrFilter],
    limit: &CustomRequestRelayLimitInput,
) -> (Vec<NostrFilter>, Vec<CustomRequestRelayLimitClamp>) {
    let mut clamps = Vec::new();
    let max_limit = limit.limits.max_limit;
    let filters = filters
        .iter()
        .enumerate()
        .map(|(index, filter)| relay_filter(relay, filter, index, max_limit, &mut clamps))
        .collect();
    (filters, clamps)
}

fn relay_filter(
    relay: &str,
    filter: &NostrFilter,
    index: usize,
    max_limit: Option<u64>,
    clamps: &mut Vec<CustomRequestRelayLimitClamp>,
) -> NostrFilter {
    let Some(cap) = max_limit else {
        return filter.clone();
    };
    let Some(original_limit) = filter.limit else {
        return filter.clone();
    };
    if cap >= original_limit {
        return filter.clone();
    }
    let mut next = filter.clone();
    next.limit = Some(cap);
    clamps.push(CustomRequestRelayLimitClamp {
        relay_url: relay.to_owned(),
        filter_index: index,
        original_limit,
        effective_limit: cap,
    });
    next
}
