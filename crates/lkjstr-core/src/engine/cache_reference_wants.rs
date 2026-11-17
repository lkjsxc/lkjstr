//! Residual held-row identities join the one engine plan after local storage answers.
use super::*;
use lkjstr_protocol::NostrFilter;
use std::collections::BTreeSet;
impl Engine {
    fn cache_reference_sources(&self) -> BTreeSet<String> {
        self.views
            .iter()
            .filter(|(_, view)| {
                view.visible
                    && !super::query::signed_out(&view.query)
                    && crate::engine::public_reads::allowed(
                        &self.store,
                        &self.private_lists,
                        &view.query,
                    )
            })
            .map(|(sub, _)| sub.clone())
            .collect()
    }

    /// Replace the whole registry so dropped/denied holds release their owners.
    /// Transport may namespace IDs; it cannot select relays or construct filters.
    pub fn cache_references(&mut self, wants: Vec<(String, Vec<String>)>, now: u64) {
        let allowed = self.cache_reference_sources();
        let next = wants
            .into_iter()
            .take(128)
            .filter_map(|(sub, ids)| {
                if !allowed.contains(&sub) {
                    return None;
                }
                let ids: Vec<_> = ids
                    .into_iter()
                    .take(1600)
                    .filter(|id| {
                        lkjstr_protocol::is_event_id(id)
                            && self.store.get(id).is_none()
                            && !self.store.verified_deleted(id)
                    })
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .collect();
                (!ids.is_empty()).then_some((sub, ids))
            })
            .collect();
        if self.read_contexts.references != next {
            self.read_contexts.references = next;
            self.replan(now);
        }
    }
    pub(in crate::engine) fn release_cache_references(&mut self, sub: &str) {
        self.read_contexts.references.remove(sub);
    }
    pub(in crate::engine) fn cache_reference_wants(&mut self) -> Vec<(String, NostrFilter, Query)> {
        let allowed = self.cache_reference_sources();
        let store = &self.store;
        self.read_contexts.references.retain(|sub, ids| {
            ids.retain(|id| store.get(id).is_none() && !store.verified_deleted(id));
            allowed.contains(sub) && !ids.is_empty()
        });
        self.read_contexts
            .references
            .iter()
            .flat_map(|(sub, ids)| {
                self.views.get(sub).into_iter().flat_map(move |view| {
                    ids.chunks(120).map(move |ids| {
                        (
                            sub.clone(),
                            NostrFilter {
                                ids: Some(ids.to_vec()),
                                limit: Some(ids.len() as u64),
                                ..Default::default()
                            },
                            view.query.clone(),
                        )
                    })
                })
            })
            .collect()
    }
}
#[cfg(test)]
#[path = "cache_reference_wants_test.rs"]
mod tests;
