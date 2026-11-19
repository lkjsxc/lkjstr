//! Cached heads ask for a fresh gap; a finite inclusive repair preserves unknown older data.
use super::*;
use crate::store::Store;
impl Network {
    pub(super) fn cached_boundary(
        &self,
        relay: &str,
        filter: &NostrFilter,
        members: &BTreeSet<String>,
        queries: &BTreeMap<String, &Query>,
        store: &Store,
        now: u64,
    ) -> Option<u64> {
        if filter.until.is_some() || filter.ids.is_some() || filter.search.is_some() {
            return None;
        }
        if let Some(request) = self
            .requests
            .values()
            .find(|r| r.relay == relay && want_key::same(&r.page_filter, filter))
        {
            return request.cached_until;
        }
        let query = members
            .iter()
            .filter(|member| !member.starts_with('~'))
            .filter_map(|member| queries.get(member).copied())
            .find(|query| {
                matches!(
                    query.source,
                    Source::Global
                        | Source::Home
                        | Source::TheirHome
                        | Source::Profile
                        | Source::Hashtag
                        | Source::Notifications
                        | Source::Thread
                ) && want_key::same(filter, &crate::engine::query::filter(store, query))
            })?;
        // Cache membership is not a coverage proof. Exclude future timestamps and
        // always retain a separate older repair, including on a Worker restart.
        crate::engine::query::events(store, query)
            .into_iter()
            .filter(|event| {
                event.created_at <= now / 1000 && lkjstr_protocol::matches_filter(event, filter)
            })
            .map(|event| event.created_at)
            .max()
    }
    pub(super) fn add_cache_repairs(
        &self,
        desired: &mut Desired,
        queries: &BTreeMap<String, &Query>,
        store: &Store,
        now: u64,
    ) {
        let repairs: Vec<_> = desired
            .iter()
            .filter_map(|((relay, _), (filter, members))| {
                let boundary = self.cached_boundary(relay, filter, members, queries, store, now)?;
                let mut repair = filter.clone();
                repair.until = Some(boundary);
                let owners: BTreeSet<_> = members
                    .iter()
                    .filter(|member| !member.starts_with('~'))
                    .map(|member| format!("~repair:{member}"))
                    .collect();
                (!owners.is_empty())
                    .then(|| ((relay.clone(), want_key::key(&repair)), repair, owners))
            })
            .collect();
        for (key, filter, members) in repairs {
            desired
                .entry(key)
                .or_insert_with(|| (filter, BTreeSet::new()))
                .1
                .extend(members);
        }
    }
}
