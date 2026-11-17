//! Logical count wants inherit routes from the physical buckets that cover them.
//! Route continuity never grants a new physical filter an old event watermark.
use super::{Network, NostrFilter, Request, profiles};
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn family(filter: &NostrFilter, members: &BTreeSet<String>) -> Option<u8> {
    if filter.ids.is_some() {
        return None;
    }
    profiles::family(filter, members).filter(|kind| matches!(kind, 2 | 4 | 5))
}
pub(super) fn failed(request: &Request, now: u64) -> bool {
    !request.page_eose && (request.complete || (request.asked && now >= request.initial_deadline))
}
impl Network {
    pub(super) fn count_routes(
        &self,
        filter: &NostrFilter,
        now: u64,
    ) -> Option<BTreeMap<&str, &Request>> {
        let kind = family(filter, &BTreeSet::new())?;
        let wanted: BTreeSet<_> = filter.tags["e"].iter().map(String::as_str).collect();
        if wanted.is_empty() {
            return Some(BTreeMap::new());
        }
        let mut covered: BTreeMap<&str, (&Request, BTreeSet<&str>)> = BTreeMap::new();
        for request in self
            .requests
            .values()
            .filter(|request| family(&request.page_filter, &request.members) == Some(kind))
        {
            let targets: BTreeSet<_> = request.page_filter.tags["e"]
                .iter()
                .map(String::as_str)
                .filter(|target| wanted.contains(target))
                .collect();
            if targets.is_empty() {
                continue;
            }
            let (representative, held) = covered
                .entry(request.relay.as_str())
                .or_insert_with(|| (request, BTreeSet::new()));
            // One answered bucket cannot hide a failed required part of the want.
            if failed(request, now) {
                *representative = request;
            }
            held.extend(targets);
        }
        Some(
            covered
                .into_iter()
                .filter(|(_, (_, targets))| targets.len() == wanted.len())
                .map(|(relay, (request, _))| (relay, request))
                .collect(),
        )
    }
}
