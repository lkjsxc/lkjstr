//! Canonical logical identity and local immutable-ID gaps. No routing decisions in callers.
use super::{NostrFilter, Query, Source};
use crate::store::Store;
pub(crate) fn key(filter: &NostrFilter) -> String {
    lkjstr_protocol::filter_to_value(&crate::engine::filter_identity::canonical(filter.clone()))
        .to_string()
}
pub(in crate::engine) fn same(a: &NostrFilter, b: &NostrFilter) -> bool {
    a == b
        || crate::engine::filter_identity::canonical(a.clone())
            == crate::engine::filter_identity::canonical(b.clone())
}
pub(super) fn gaps(
    wants: Vec<(String, NostrFilter, Query)>,
    store: &Store,
) -> Vec<(String, NostrFilter, Query)> {
    wants
        .into_iter()
        .filter_map(|(sub, mut filter, query)| {
            // Internal publication/authority work may require remote evidence even for
            // a local object. Ordinary row wants need only immutable bodies not held.
            if !sub.starts_with('~')
                && let Some(ids) = &mut filter.ids
            {
                ids.retain(|id| {
                    store.get(id).is_none()
                        || (query.source == Source::Relay
                            && query
                                .target
                                .as_ref()
                                .is_some_and(|relay| !store.seen_on(id).contains(relay)))
                });
                ids.sort();
                ids.dedup();
                if ids.is_empty() {
                    return None;
                }
            }
            Some((
                sub,
                crate::engine::filter_identity::canonical(filter),
                query,
            ))
        })
        .collect()
}
