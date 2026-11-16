//! Recovered live data may replace an answered route with no verified matches.
//! No extra route slot, new retained state, or raw-frame credit is introduced.
use super::{super::Request, Candidate};
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn promote(
    routes: &mut [String],
    candidates: &[Candidate],
    current: &BTreeMap<&str, &Request>,
    unavailable: &BTreeSet<String>,
    hints: &[String],
) {
    for candidate in candidates {
        let Some(request) = current.get(candidate.url.as_str()) else {
            continue;
        };
        if routes.contains(&candidate.url)
            || hints.contains(&candidate.url)
            || unavailable.contains(&candidate.url)
            || request.read_slot
            || !request.live
            || !request.eose
            || request.complete
            || request.last_event.is_none()
        {
            continue;
        }
        // Exact matching verified data, including a verified cached replay, is
        // evidence for this filter. An unresolved or productive primary cannot yield.
        let empty = routes.iter().position(|url| {
            current.get(url.as_str()).is_some_and(|r| {
                r.read_slot && r.live && r.eose && r.page_eose && r.last_event.is_none()
            })
        });
        let Some(index) = empty else { break };
        routes[index] = candidate.url.clone();
    }
}
