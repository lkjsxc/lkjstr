//! NIP-11 constraints, observed failures and bounded usefulness statistics.
use super::network::*;
impl Network {
    pub fn relay_information(&mut self, relay: &str, json: &str) {
        let Ok(info) = lkjstr_nips::metadata::RelayInformation::parse(json, 65536) else {
            return;
        };
        if let Some(r) = self.relays.get_mut(relay) {
            // NIP-01 advertises multi-filter REQ support. Try only two when no
            // tighter NIP-11 limit is given; CLOSED falls back to single filters.
            if info.supports(1) && r.max_filters <= 1 && !r.single_filters {
                r.max_filters = 2;
            }
            if let Some(limit) = info
                .limitation
                .as_ref()
                .and_then(|l| l.get("max_subscriptions"))
                .and_then(|v| v.as_u64())
            {
                r.max_reqs = (limit as usize).clamp(1, 4);
            }
            if let Some(limit) = info
                .limitation
                .as_ref()
                .and_then(|l| l.get("max_limit"))
                .and_then(|v| v.as_u64())
            {
                r.max_limit = limit.clamp(1, 200);
            }
            if let Some(limit) = info
                .limitation
                .as_ref()
                .and_then(|l| l.get("max_filters"))
                .and_then(|v| v.as_u64())
            {
                r.max_filters = limit.clamp(1, 8) as usize;
            }
            if r.single_filters {
                r.max_filters = 1;
            }
            r.nip11 = true;
        }
    }
}
impl Network {
    pub fn lookup_failed(&self, id: &str) -> bool {
        let rs: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                r.filter
                    .ids
                    .as_ref()
                    .is_some_and(|ids| ids.iter().any(|v| v == id))
            })
            .collect();
        !rs.is_empty() && rs.iter().all(|r| r.complete || r.eose) && !rs.iter().any(|r| r.eose)
    }
    pub fn lookup_complete(&self, id: &str) -> bool {
        let matches: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                r.filter
                    .ids
                    .as_ref()
                    .is_some_and(|ids| ids.iter().any(|key| key == id))
            })
            .collect();
        !matches.is_empty() && matches.iter().all(|r| r.asked && r.eose)
    }
}
impl Network {
    pub fn request_progress(&self, sub: &str) -> (usize, usize) {
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| r.members.contains(sub))
            .collect();
        let asked = requests
            .iter()
            .filter(|r| r.asked)
            .map(|r| &r.relay)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        let answered = requests
            .iter()
            .filter(|r| r.asked && (r.page_eose || r.eose || r.last_event.is_some()))
            .map(|r| &r.relay)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        (asked, answered)
    }
}

impl Network {
    pub fn page_exhausted(&self, filter: &lkjstr_protocol::NostrFilter) -> bool {
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| r.page_filter == *filter)
            .collect();
        !requests.is_empty()
            && requests
                .iter()
                .all(|r| r.page_eose && r.received.len() < r.page_limit)
    }
    /// The shallowest full relay page advances without skipping another relay's tail.
    pub fn page_cursor(&self, filter: &lkjstr_protocol::NostrFilter) -> Option<u64> {
        self.requests
            .values()
            .filter(|r| r.page_filter == *filter && r.received.len() >= r.page_limit)
            .filter_map(|r| r.oldest)
            .max()
    }
    pub fn page_finished(&self, filter: &lkjstr_protocol::NostrFilter) -> bool {
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| r.page_filter == *filter)
            .collect();
        !requests.is_empty() && requests.iter().all(|r| r.page_eose)
    }
}

impl Network {
    /// Only an untruncated, successful owner-list lookup proves absence.
    pub fn list_loaded(&self, store: &crate::store::Store, account: &str, kind: u64) -> bool {
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                r.filter
                    .authors
                    .as_ref()
                    .is_some_and(|authors| authors.iter().any(|a| a == account))
                    && r.filter.kinds.as_ref().is_some_and(|ks| ks.contains(&kind))
                    && r.filter.ids.is_none()
                    && r.filter.tags.is_empty()
                    && r.filter.since.is_none()
                    && r.filter.until.is_none()
                    && r.filter.search.is_none()
            })
            .collect();
        !self.verifying
            && !requests.is_empty()
            && requests.iter().all(|r| {
                r.asked
                    && (r.eose || (kind == 10005 && r.page_eose))
                    && r.received.len() < r.page_limit
                    && r.received.iter().all(|id| {
                        store
                            .get(id)
                            .is_some_and(|e| e.kind != kind || e.pubkey != account)
                    })
            })
    }
}

impl Network {
    /// Termination allows fallback, even when a lookup failed or was truncated.
    pub fn profile_finished(&self, author: &str, relays: &[String]) -> bool {
        if self.verifying {
            return false;
        }
        let rs: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                (relays.is_empty() || relays.contains(&r.relay))
                    && r.filter.kinds.as_deref() == Some(&[0])
                    && r.filter
                        .authors
                        .as_ref()
                        .is_some_and(|a| a.iter().any(|a| a == author))
            })
            .collect();
        !rs.is_empty() && rs.iter().all(|r| r.asked && (r.eose || r.complete))
    }
}

impl Network {
    /// Only successful, untruncated profile lookups can establish absence.
    pub fn profile_absent(&self, author: &str) -> bool {
        self.profile_finished(author, &[])
            && self
                .requests
                .values()
                .filter(|r| {
                    r.filter.kinds.as_deref() == Some(&[0])
                        && r.filter
                            .authors
                            .as_ref()
                            .is_some_and(|a| a.iter().any(|a| a == author))
                })
                .all(|r| r.eose && r.received.len() < r.page_limit)
    }
}

impl Network {
    pub fn count_complete(
        &self,
        filter: &lkjstr_protocol::NostrFilter,
        store: &crate::store::Store,
    ) -> bool {
        let rs: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                let mut requested = filter.clone();
                if matches!(
                    requested.kinds.as_deref(),
                    Some([1, 6, 7, 9735] | [42, 16, 7, 9735])
                ) && let (Some(ids), Some(batch)) =
                    (requested.tags.get("e"), r.filter.tags.get("e"))
                    && ids.iter().all(|id| batch.contains(id))
                {
                    requested.tags.insert("e".into(), batch.clone());
                    if r.filter.kinds.as_ref().is_some_and(|ks| {
                        requested
                            .kinds
                            .as_ref()
                            .is_some_and(|want| want.iter().all(|k| ks.contains(k)))
                    }) {
                        requested.kinds = r.filter.kinds.clone();
                    }
                }
                r.filter == requested
            })
            .collect();
        !self.verifying
            && !rs.is_empty()
            && rs.iter().all(|r| {
                r.asked
                    && r.eose
                    && r.received.len() < r.page_limit
                    && r.received.iter().all(|id| store.get(id).is_some())
            })
    }
}
