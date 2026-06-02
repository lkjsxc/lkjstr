#![doc = "Custom Request mode classification."]

use lkjstr_protocol::NostrFilter;

use super::CustomRequestMode;

#[must_use]
pub fn custom_request_mode(filters: &[NostrFilter]) -> CustomRequestMode {
    if filters.iter().any(is_exact_filter) {
        CustomRequestMode::Exact
    } else {
        CustomRequestMode::AdaptiveFeed
    }
}

fn is_exact_filter(filter: &NostrFilter) -> bool {
    filter.ids.as_ref().is_some_and(|ids| !ids.is_empty()) || filter.search.is_some()
}
