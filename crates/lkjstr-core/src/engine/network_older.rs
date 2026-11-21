//! Older pivot pages keep one finite envelope and one inclusive cursor per route.
use super::*;
use crate::{engine::protocol::TimeEdge, store::Store};

const MAX_PAGES: u8 = 8;

impl Request {
    pub(super) fn owns_older(&self, owner: Option<&str>) -> bool {
        match owner {
            Some(owner) => self.older_pages.is_some() && self.members.contains(owner),
            None => self.older_pages.is_none(),
        }
    }

    fn older_verified(&self, store: &Store) -> bool {
        self.received.iter().all(|id| {
            store.get(id).is_some_and(|event| {
                self.received.timestamp(id) == Some(event.created_at)
                    && lkjstr_protocol::matches_filter(&event, &self.filter)
            })
        })
    }

    fn older_edge(&self, store: &Store, verifying: bool) -> TimeEdge {
        if !self.page_eose {
            return if self.complete {
                TimeEdge::Stalled
            } else {
                TimeEdge::Loading
            };
        }
        if verifying {
            return TimeEdge::Loading;
        }
        if !self.older_verified(store) {
            return TimeEdge::Stalled;
        }
        if self.received.len() >= self.page_limit {
            TimeEdge::Partial
        } else {
            TimeEdge::End
        }
    }
}

impl Network {
    pub(in crate::engine) fn older_edge(&self, owner: &str, store: &Store) -> TimeEdge {
        self.requests
            .values()
            .filter(|request| request.owns_older(Some(owner)))
            .map(|request| request.older_edge(store, self.verifying))
            .max_by_key(|edge| match edge {
                TimeEdge::End => 0,
                TimeEdge::Partial => 1,
                TimeEdge::Loading => 2,
                TimeEdge::Stalled => 3,
                _ => 0,
            })
            .unwrap_or(TimeEdge::CacheOnly)
    }

    pub(in crate::engine) fn advance_older(
        &mut self,
        owner: &str,
        store: &Store,
        through: Option<u64>,
    ) {
        if self.verifying {
            return;
        }
        for r in self
            .requests
            .values_mut()
            .filter(|r| r.owns_older(Some(owner)))
        {
            let Some(pages) = r.older_pages.filter(|pages| *pages < MAX_PAGES) else {
                continue;
            };
            let Some(until) = r.oldest.filter(|oldest| {
                Some(*oldest) < r.filter.until && through.is_none_or(|through| through < *oldest)
            }) else {
                continue;
            };
            if r.older_edge(store, false) != TimeEdge::Partial {
                continue;
            }
            r.filter.until = Some(until);
            r.older_pages = Some(pages + 1);
            r.page_eose = false;
            r.eose = false;
            r.complete = false;
            r.asked = false;
            r.created_at = self.now;
            r.ready_at = self.now;
            r.initial_deadline = u64::MAX;
            r.first_event_at = None;
            r.last_event = None;
            r.received.clear();
            r.oldest = None;
        }
    }
}
