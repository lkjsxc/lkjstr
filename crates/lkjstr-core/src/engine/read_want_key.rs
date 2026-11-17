//! Canonical logical identity and local immutable-ID gaps. No routing decisions in callers.
use super::{NostrFilter, Query, Source};
use crate::store::Store;
fn set<T: Ord>(values: &mut Option<Vec<T>>) {
    if let Some(values) = values {
        values.sort();
        values.dedup();
    }
}
pub(in crate::engine) fn key(filter: &NostrFilter) -> String {
    let mut canonical = filter.clone();
    set(&mut canonical.ids);
    set(&mut canonical.authors);
    set(&mut canonical.kinds);
    for values in canonical.tags.values_mut() {
        values.sort();
        values.dedup();
    }
    lkjstr_protocol::filter_to_value(&canonical).to_string()
}
pub(in crate::engine) fn same(a: &NostrFilter, b: &NostrFilter) -> bool {
    a == b || key(a) == key(b)
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
            Some((sub, filter, query))
        })
        .collect()
}
