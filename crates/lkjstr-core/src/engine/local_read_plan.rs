//! Every exact-ID want passes this gate before the ordinary relay planner.
use super::*;
use crate::engine::{protocol::Query, public_reads};
use lkjstr_protocol::NostrFilter;

fn exact(filter: &NostrFilter) -> bool {
    filter
        .ids
        .as_ref()
        .is_some_and(|ids| !ids.is_empty() && ids.iter().all(|id| lkjstr_protocol::is_event_id(id)))
        && filter.limit != Some(0)
        && filter
            .authors
            .as_ref()
            .is_none_or(|values| !values.is_empty())
        && filter
            .kinds
            .as_ref()
            .is_none_or(|values| !values.is_empty())
        && filter.tags.values().all(|values| !values.is_empty())
}

impl Engine {
    fn local_read_scope(&self, owner: &str, query: &Query) -> bool {
        !owner.starts_with("~dm")
            && !crate::engine::query::signed_out(query)
            && public_reads::allowed(&self.store, &self.private_lists, query)
    }

    fn local_read_evidence(&self) -> (BTreeSet<String>, BTreeSet<String>) {
        let queued = self
            .queue
            .iter()
            .map(|queued| queued.event.id.clone())
            .collect();
        // Queued or already-asked relay atoms are never taken away by this gate.
        let network = self
            .network
            .requests
            .values()
            .flat_map(|request| request.page_filter.ids.iter().flatten())
            .cloned()
            .collect();
        (queued, network)
    }

    pub(in crate::engine) fn reconcile_local_reads(&mut self, now: u64) -> bool {
        if !self.local_reads.enabled {
            return false;
        }
        let (queued, network) = self.local_read_evidence();
        self.local_reads
            .reconcile(&self.store, &queued, &network, now)
    }

    pub(in crate::engine) fn plan_local_reads(
        &mut self,
        wants: &mut Vec<(String, NostrFilter, Query)>,
        now: u64,
    ) {
        if !self.local_reads.enabled {
            return;
        }
        let mut wanted: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for (owner, filter, query) in wants.iter() {
            if exact(filter) && self.local_read_scope(owner, query) {
                for id in filter.ids.iter().flatten() {
                    wanted.entry(id.clone()).or_default().insert(owner.clone());
                }
            }
        }
        let (queued, network) = self.local_read_evidence();
        self.local_reads
            .synchronize(wanted, &self.store, &queued, &network, now);
        self.local_reads
            .reconcile(&self.store, &queued, &network, now);
        wants.retain_mut(|(owner, filter, query)| {
            if !exact(filter) || !self.local_read_scope(owner, query) {
                return true;
            }
            let Some(ids) = &mut filter.ids else {
                return true;
            };
            ids.retain(|id| {
                network.contains(id)
                    || (self.store.get(id).is_none() && !self.local_reads.pending(id, now))
            });
            !ids.is_empty()
        });
    }
}
