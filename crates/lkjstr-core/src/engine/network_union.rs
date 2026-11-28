//! Safe physical unions: retain independent filters, limits and logical ownership.
use super::*;
use crate::{engine::settings::PrivateLists, store::Store};

pub(super) fn allowed(
    filter: &NostrFilter,
    members: &BTreeSet<String>,
    queries: &BTreeMap<String, &Query>,
    store: &Store,
    private: &PrivateLists,
) -> bool {
    filter.ids.is_none()
        && filter.until.is_none()
        && filter.search.is_none()
        && filter.kinds.as_ref().is_some_and(|ks| {
            !ks.is_empty()
                && ks
                    .iter()
                    .all(|k| matches!(k, 1 | 6 | 7 | 16 | 41 | 42 | 9735))
        })
        && members.iter().all(|member| {
            queries.get(member).is_some_and(|q| {
                (!member.starts_with('~')
                    || crate::engine::discovery::notification_watch(member, q))
                    && matches!(
                        q.source,
                        Source::Home
                            | Source::TheirHome
                            | Source::Global
                            | Source::Profile
                            | Source::Thread
                            | Source::Notifications
                            | Source::Hashtag
                            | Source::Relay
                            | Source::Channel
                    )
                    && crate::engine::public_reads::allowed(store, private, q)
            })
        })
}

fn prefixes(a: &Option<Vec<String>>, b: &Option<Vec<String>>) -> bool {
    match (a, b) {
        (Some(a), Some(b)) => a
            .iter()
            .any(|x| b.iter().any(|y| x.starts_with(y) || y.starts_with(x))),
        (Some(a), None) | (None, Some(a)) => !a.is_empty(),
        (None, None) => true,
    }
}

/// Conservative set intersection. An overlap permits batching, never quota subsumption.
pub(super) fn overlaps(a: &NostrFilter, b: &NostrFilter) -> bool {
    if !prefixes(&a.ids, &b.ids) || !prefixes(&a.authors, &b.authors) {
        return false;
    }
    if let (Some(a), Some(b)) = (&a.kinds, &b.kinds)
        && !a.iter().any(|k| b.contains(k))
    {
        return false;
    }
    if a.since.unwrap_or(0).max(b.since.unwrap_or(0))
        > a.until.unwrap_or(u64::MAX).min(b.until.unwrap_or(u64::MAX))
    {
        return false;
    }
    !a.tags.iter().any(|(tag, values)| {
        b.tags
            .get(tag)
            .is_some_and(|other| !values.iter().any(|v| other.contains(v)))
    })
}
