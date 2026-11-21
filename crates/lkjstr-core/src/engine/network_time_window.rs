//! Scoped time pages keep independent cursors and relay evidence per route.
use super::*;
use crate::{engine::protocol::TimeEdge, store::Store};

const MAX_PAGES: u8 = 8;

pub(super) struct TimePages {
    count: u8,
    newer: Option<NewerCoverage>,
}

#[derive(Default)]
struct NewerCoverage {
    // At most seven earlier pages, with at most 200 distinct ids per page.
    verified: BTreeSet<String>,
    saturated: bool,
}

impl TimePages {
    pub(super) fn new(owner: &str) -> Self {
        Self {
            count: 1,
            newer: crate::engine::time_window_relay::is_newer(owner).then(NewerCoverage::default),
        }
    }
}

impl Request {
    pub(in crate::engine) fn owns_time(&self, owner: Option<&str>) -> bool {
        match owner {
            Some(owner) => self.time_pages.is_some() && self.members.contains(owner),
            None => self.time_pages.is_none(),
        }
    }

    fn time_edge(&self, pages: &TimePages, store: &Store, verifying: bool) -> TimeEdge {
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
        let verified = self.received.iter().all(|id| {
            store.get(id).is_some_and(|event| {
                self.received.timestamp(id) == Some(event.created_at)
                    && lkjstr_protocol::matches_filter(&event, &self.filter)
            })
        }) && pages
            .newer
            .as_ref()
            .is_none_or(|coverage| coverage.verified.iter().all(|id| store.get(id).is_some()));
        if !verified {
            return TimeEdge::Stalled;
        }
        if self.received.len() >= self.page_limit
            || pages
                .newer
                .as_ref()
                .is_some_and(|coverage| coverage.saturated)
        {
            TimeEdge::Partial
        } else {
            TimeEdge::End
        }
    }

    fn advance_time(&mut self, store: &Store, through: Option<u64>, now: u64) {
        let Some(pages) = self.time_pages.as_ref() else {
            return;
        };
        if pages.count >= MAX_PAGES
            || self.received.len() < self.page_limit
            || self.time_edge(pages, store, false) != TimeEdge::Partial
        {
            return;
        }
        let (Some(oldest), Some(upper)) = (self.oldest, self.filter.until) else {
            return;
        };
        let saturated = oldest == upper;
        let until = if pages.newer.is_some() {
            // Keep the overlap unless a full page is stuck at one second.
            // In that case seek nearer rows and retain the uncertainty.
            if saturated {
                let Some(until) = oldest
                    .checked_sub(1)
                    .filter(|at| Some(*at) >= self.filter.since)
                else {
                    return;
                };
                until
            } else {
                oldest
            }
        } else {
            if saturated || through.is_some_and(|through| through >= oldest) {
                return;
            }
            oldest
        };
        if let Some(pages) = &mut self.time_pages {
            pages.count += 1;
            if let Some(coverage) = &mut pages.newer {
                coverage.verified.extend(self.received.iter().cloned());
                coverage.saturated |= saturated;
            }
        }
        self.filter.until = Some(until);
        self.page_eose = false;
        self.eose = false;
        self.complete = false;
        self.asked = false;
        self.created_at = now;
        self.ready_at = now;
        self.initial_deadline = u64::MAX;
        self.first_event_at = None;
        self.last_event = None;
        self.received.clear();
        self.oldest = None;
    }
}

impl Network {
    pub(in crate::engine) fn time_edge(
        &mut self,
        owner: &str,
        store: &Store,
        through: Option<u64>,
    ) -> TimeEdge {
        self.requests
            .values_mut()
            .filter(|r| r.owns_time(Some(owner)))
            .filter_map(|r| {
                if !self.verifying {
                    r.advance_time(store, through, self.now);
                }
                Some(r.time_edge(r.time_pages.as_ref()?, store, self.verifying))
            })
            .max_by_key(|edge| match edge {
                TimeEdge::End => 0,
                TimeEdge::Partial => 1,
                TimeEdge::Loading => 2,
                TimeEdge::Stalled => 3,
                _ => 0,
            })
            .unwrap_or(TimeEdge::CacheOnly)
    }
}
