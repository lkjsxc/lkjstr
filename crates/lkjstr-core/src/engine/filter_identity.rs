//! Exact filter identity: OR selector order/repetition is not another relay read.
use lkjstr_protocol::NostrFilter;

/// Preserve every predicate, bound and empty selector; only canonicalize OR sets.
pub(super) fn canonical(mut filter: NostrFilter) -> NostrFilter {
    fn set<T: Ord>(values: &mut Option<Vec<T>>) {
        if let Some(values) = values {
            values.sort_unstable();
            values.dedup();
        }
    }
    set(&mut filter.ids);
    set(&mut filter.authors);
    set(&mut filter.kinds);
    for values in filter.tags.values_mut() {
        values.sort_unstable();
        values.dedup();
    }
    filter
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_selectors_remain_distinct_from_absent_selectors() {
        let absent = NostrFilter::default();
        for field in ["ids", "authors", "kinds", "tag"] {
            let mut empty = absent.clone();
            match field {
                "ids" => empty.ids = Some(vec![]),
                "authors" => empty.authors = Some(vec![]),
                "kinds" => empty.kinds = Some(vec![]),
                _ => {
                    empty.tags.insert("e".into(), vec![]);
                }
            }
            assert_eq!(canonical(empty.clone()), empty);
            assert_ne!(canonical(empty), canonical(absent.clone()), "{field}");
        }
    }

    #[test]
    fn bounds_limits_search_and_prefixes_are_never_widened() {
        let original = NostrFilter {
            ids: Some(vec!["abcd".into(), "ab".into(), "abcd".into()]),
            authors: Some(vec!["ff".into(), "f".into()]),
            kinds: Some(vec![6, 1, 6]),
            since: Some(0),
            until: Some(10),
            limit: Some(0),
            search: Some(" exact Case ".into()),
            tags: [
                ("e".into(), vec!["z".into(), "a".into(), "z".into()]),
                ("p".into(), vec!["z".into()]),
            ]
            .into(),
        };
        let normalized = canonical(original.clone());
        assert_eq!(normalized.ids, Some(vec!["ab".into(), "abcd".into()]));
        assert_eq!(normalized.authors, Some(vec!["f".into(), "ff".into()]));
        assert_eq!(normalized.kinds, Some(vec![1, 6]));
        assert_eq!(normalized.tags["e"], vec!["a", "z"]);
        assert_eq!(normalized.tags["p"], vec!["z"]);
        assert_eq!(normalized.since, original.since);
        assert_eq!(normalized.until, original.until);
        assert_eq!(normalized.limit, original.limit);
        assert_eq!(normalized.search, original.search);
        assert_eq!(canonical(normalized.clone()), normalized);
    }
}
